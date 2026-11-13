import re
import threading
from pathlib import Path
from typing import Any, Tuple, Optional
import duckdb
import pandas as pd
from app.config import settings, UPLOAD_DIR
from app.core.security import validate_read_only_sql
from app.models.schemas import ColumnInfo, DatasetSummary, TableMetadata

_MAX_SAMPLE_CHARS = 80


class DatasetManager:
    """Manages multiple DuckDB in-memory tables, file ingestion, and relational schema profiling."""

    def __init__(self):
        self.con = self._create_locked_connection()
        self._lock = threading.RLock()
        self.active_dataset_id: str | None = None
        self.active_table_name: str | None = None
        self.active_filename: str | None = None
        # table_name -> {"filename", "columns", "row_count", "preview_rows"}
        self.tables: dict[str, dict[str, Any]] = {}

    @staticmethod
    def _create_locked_connection() -> duckdb.DuckDBPyConnection:
        """In-memory DuckDB with filesystem access restricted to UPLOAD_DIR and settings locked."""
        con = duckdb.connect(
            database=":memory:",
            config={
                "autoinstall_known_extensions": False,
                "autoload_known_extensions": False,
                "memory_limit": settings.DUCKDB_MEMORY_LIMIT,
                "threads": settings.DUCKDB_THREADS,
            },
        )
        upload_dir_sql = UPLOAD_DIR.as_posix().replace("'", "''")
        con.execute(f"SET allowed_directories = ['{upload_dir_sql}']")
        con.execute("SET enable_external_access = false")
        con.execute("SET lock_configuration = true")
        return con

    def _sanitize_table_name(self, filename: str) -> str:
        stem = Path(filename).stem.lower()
        clean = re.sub(r"[^a-z0-9_]", "_", stem)
        clean = re.sub(r"_+", "_", clean).strip("_")[:60]
        if not clean or clean[0].isdigit():
            clean = f"tbl_{clean}" if clean else "dataset_tbl"
        if clean == "data_table":
            clean = "uploaded_table"
        return clean

    def load_file(self, file_path: Path, filename: str) -> DatasetSummary:
        resolved_path = file_path.resolve()
        if UPLOAD_DIR not in resolved_path.parents:
            raise ValueError("File must be located inside the uploads directory.")

        ext = resolved_path.suffix.lower()
        table_name = self._sanitize_table_name(filename)
        if table_name not in self.tables and len(self.tables) >= settings.MAX_TABLES:
            raise ValueError(
                f"Table limit reached ({settings.MAX_TABLES}). Remove a table before uploading another."
            )

        path_sql = resolved_path.as_posix().replace("'", "''")
        with self._lock:
            if ext == ".csv":
                self.con.execute(
                    f"CREATE OR REPLACE TABLE \"{table_name}\" AS SELECT * FROM read_csv_auto('{path_sql}');"
                )
            elif ext in [".xlsx", ".xls"]:
                df = pd.read_excel(resolved_path)
                tmp_name = f"__tmp_{table_name}"
                self.con.register(tmp_name, df)
                try:
                    self.con.execute(f'CREATE OR REPLACE TABLE "{table_name}" AS SELECT * FROM "{tmp_name}";')
                finally:
                    self.con.unregister(tmp_name)
            elif ext == ".parquet":
                self.con.execute(
                    f"CREATE OR REPLACE TABLE \"{table_name}\" AS SELECT * FROM read_parquet('{path_sql}');"
                )
            else:
                raise ValueError(
                    f"Unsupported file format: {ext}. Please upload a CSV, Excel (.xlsx/.xls), or Parquet file."
                )

            self.tables[table_name] = self._profile_table(table_name, filename)
            return self.activate_table(table_name)

    @staticmethod
    def _truncate_sample(value: Any) -> Any:
        if isinstance(value, str) and len(value) > _MAX_SAMPLE_CHARS:
            return value[:_MAX_SAMPLE_CHARS] + "…"
        return value

    def _profile_table(self, table_name: str, filename: str) -> dict[str, Any]:
        count_res = self.con.execute(f'SELECT COUNT(*) FROM "{table_name}";').fetchone()
        row_count = count_res[0] if count_res else 0

        describe_res = self.con.execute(f'DESCRIBE "{table_name}";').fetchall()
        columns: list[ColumnInfo] = []

        for row in describe_res:
            col_name = str(row[0])
            col_type = str(row[1])
            quoted = col_name.replace('"', '""')

            try:
                samples = self.con.execute(
                    f'SELECT DISTINCT "{quoted}" FROM "{table_name}" WHERE "{quoted}" IS NOT NULL LIMIT 3;'
                ).fetchall()
                sample_vals = [self._truncate_sample(s[0]) for s in samples]
            except Exception:
                sample_vals = []

            try:
                nulls = self.con.execute(
                    f'SELECT COUNT(*) FROM "{table_name}" WHERE "{quoted}" IS NULL;'
                ).fetchone()
                null_count = nulls[0] if nulls else 0
            except Exception:
                null_count = 0

            columns.append(
                ColumnInfo(
                    name=col_name,
                    data_type=col_type,
                    sample_values=sample_vals,
                    null_count=null_count,
                )
            )

        preview_df = self.con.execute(f'SELECT * FROM "{table_name}" LIMIT 5;').df()
        preview_rows = self._clean_records(preview_df.to_dict(orient="records"))

        return {
            "table_name": table_name,
            "filename": filename,
            "row_count": row_count,
            "columns": columns,
            "preview_rows": preview_rows,
        }

    def activate_table(self, table_name: str) -> DatasetSummary:
        with self._lock:
            if table_name not in self.tables:
                raise ValueError(f"Table '{table_name}' is not loaded.")

            self.active_table_name = table_name
            self.active_dataset_id = table_name
            self.active_filename = self.tables[table_name]["filename"]

            # Point `data_table` alias view to the active table so single-table queries work transparently
            self.con.execute("DROP VIEW IF EXISTS data_table;")
            self.con.execute(f'CREATE OR REPLACE VIEW data_table AS SELECT * FROM "{table_name}";')

            return self.get_summary()

    def remove_table(self, table_name: str) -> Optional[DatasetSummary]:
        with self._lock:
            if table_name not in self.tables:
                raise ValueError(f"Table '{table_name}' does not exist.")

            del self.tables[table_name]
            try:
                self.con.execute("DROP VIEW IF EXISTS data_table;")
                self.con.execute(f'DROP TABLE IF EXISTS "{table_name}";')
            except Exception:
                pass

            if len(self.tables) == 0:
                self.active_table_name = None
                self.active_dataset_id = None
                self.active_filename = None
                return None

            next_table = list(self.tables.keys())[-1]
            return self.activate_table(next_table)

    def get_loaded_tables_metadata(self) -> list[TableMetadata]:
        return [
            TableMetadata(
                table_name=t_name,
                filename=info["filename"],
                row_count=info["row_count"],
                column_count=len(info["columns"]),
                columns=[c.name for c in info["columns"]],
            )
            for t_name, info in self.tables.items()
        ]

    def find_joinable_columns(self) -> list[dict[str, str]]:
        """Finds matching column names across pairs of loaded tables for SQL JOINs."""
        table_names = list(self.tables.keys())
        joins: list[dict[str, str]] = []
        if len(table_names) < 2:
            return joins

        for i in range(len(table_names)):
            for j in range(i + 1, len(table_names)):
                t1 = table_names[i]
                t2 = table_names[j]
                cols1 = {c.name.lower(): c.name for c in self.tables[t1]["columns"]}
                cols2 = {c.name.lower(): c.name for c in self.tables[t2]["columns"]}
                for key_lower in set(cols1) & set(cols2):
                    joins.append(
                        {
                            "left_table": t1,
                            "right_table": t2,
                            "left_col": cols1[key_lower],
                            "right_col": cols2[key_lower],
                        }
                    )
        return joins

    def get_all_tables_schema_context(self) -> str:
        """Builds a schema description of all loaded tables and join keys for the LLM."""
        if not self.tables:
            return "No tables loaded."

        sections: list[str] = []
        for t_name, info in self.tables.items():
            is_active = " (ACTIVE DEFAULT TABLE / also aliased as `data_table`)" if t_name == self.active_table_name else ""
            col_lines = [
                f'  - "{col.name}" ({col.data_type}, Nulls: {col.null_count}, Samples: {col.sample_values})'
                for col in info["columns"]
            ]
            sections.append(
                f'Table: "{t_name}"{is_active} — File: {info["filename"]} ({info["row_count"]} rows)\n'
                + "\n".join(col_lines)
            )

        joins = self.find_joinable_columns()
        if joins:
            join_lines = [
                f'  - "{j["left_table"]}"."{j["left_col"]}" = "{j["right_table"]}"."{j["right_col"]}"'
                for j in joins
            ]
            sections.append("Detected Relational Join Keys:\n" + "\n".join(join_lines))

        return "\n\n".join(sections)

    def get_summary(self) -> DatasetSummary:
        if not self.active_table_name or self.active_table_name not in self.tables:
            raise ValueError("No active dataset loaded.")

        info = self.tables[self.active_table_name]
        return DatasetSummary(
            dataset_id=self.active_table_name,
            table_name=self.active_table_name,
            filename=info["filename"],
            row_count=info["row_count"],
            column_count=len(info["columns"]),
            columns=info["columns"],
            preview_rows=info["preview_rows"],
            loaded_tables=self.get_loaded_tables_metadata(),
        )

    def execute_query(self, query: str, limit: int = 500) -> Tuple[list[dict[str, Any]], list[str]]:
        """Validates and executes a read-only SQL query with a row cap and timeout."""
        clean_query = validate_read_only_sql(query)
        # Newlines keep a trailing `--` comment from swallowing the wrapper.
        wrapped_query = f"SELECT * FROM (\n{clean_query}\n) AS q LIMIT {int(limit)};"

        with self._lock:
            timer = threading.Timer(settings.QUERY_TIMEOUT_SECONDS, self.con.interrupt)
            timer.start()
            try:
                rel = self.con.execute(wrapped_query)
                col_names = [desc[0] for desc in rel.description]
                df = rel.df()
            except duckdb.InterruptException as exc:
                raise TimeoutError(
                    f"Query exceeded the {settings.QUERY_TIMEOUT_SECONDS:g}s time limit and was cancelled."
                ) from exc
            finally:
                timer.cancel()

        records = df.to_dict(orient="records")
        return self._clean_records(records), col_names

    def _clean_records(self, records: list[dict[str, Any]]) -> list[dict[str, Any]]:
        cleaned = []
        for row in records:
            cleaned_row = {}
            for k, v in row.items():
                if pd.api.types.is_scalar(v) and pd.isna(v):
                    cleaned_row[k] = None
                elif hasattr(v, "isoformat"):
                    cleaned_row[k] = v.isoformat()
                else:
                    cleaned_row[k] = v
            cleaned.append(cleaned_row)
        return cleaned


dataset_manager = DatasetManager()
