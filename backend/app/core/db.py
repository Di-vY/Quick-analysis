import re
from pathlib import Path
from typing import Any, Tuple, Optional
import duckdb
import pandas as pd
from app.models.schemas import ColumnInfo, DatasetSummary, TableMetadata


class DatasetManager:
    """Manages multiple DuckDB in-memory tables, file ingestion, and relational schema profiling."""

    def __init__(self):
        # Persistent in-memory DuckDB connection supporting multiple tables and SQL JOINs
        self.con = duckdb.connect(database=":memory:")
        self.active_dataset_id: str | None = None
        self.active_table_name: str | None = None
        self.active_filename: str | None = None
        # Store loaded tables by table_name -> {"filename": str, "columns": list[ColumnInfo], "row_count": int, "preview_rows": list}
        self.tables: dict[str, dict[str, Any]] = {}

    def _sanitize_table_name(self, filename: str) -> str:
        stem = Path(filename).stem.lower()
        clean = re.sub(r"[^a-z0-9_]", "_", stem)
        clean = re.sub(r"_+", "_", clean).strip("_")
        if not clean or clean[0].isdigit():
            clean = f"tbl_{clean}" if clean else "dataset_tbl"
        if clean == "data_table":
            clean = "uploaded_table"
        return clean

    def load_file(self, file_path: Path, filename: str) -> DatasetSummary:
        resolved_path = file_path.resolve()
        ext = resolved_path.suffix.lower()
        table_name = self._sanitize_table_name(filename)

        if ext == ".csv":
            self.con.execute(
                f'CREATE OR REPLACE TABLE "{table_name}" AS SELECT * FROM read_csv_auto(\'{resolved_path.as_posix()}\', all_varchar=false);'
            )
        elif ext in [".xlsx", ".xls"]:
            df = pd.read_excel(resolved_path)
            self.con.register(f"__tmp_{table_name}", df)
            self.con.execute(
                f'CREATE OR REPLACE TABLE "{table_name}" AS SELECT * FROM "__tmp_{table_name}";'
            )
            self.con.unregister(f"__tmp_{table_name}")
        elif ext == ".parquet":
            self.con.execute(
                f'CREATE OR REPLACE TABLE "{table_name}" AS SELECT * FROM read_parquet(\'{resolved_path.as_posix()}\');'
            )
        else:
            raise ValueError(
                f"Unsupported file format: {ext}. Please upload a CSV, Excel (.xlsx/.xls), or Parquet file."
            )

        # Profile this newly created table
        profile = self._profile_table(table_name, filename)
        self.tables[table_name] = profile

        # Activate this table and sync `data_table` view alias
        return self.activate_table(table_name)

    def _profile_table(self, table_name: str, filename: str) -> dict[str, Any]:
        count_res = self.con.execute(f'SELECT COUNT(*) FROM "{table_name}";').fetchone()
        row_count = count_res[0] if count_res else 0

        describe_res = self.con.execute(f'DESCRIBE "{table_name}";').fetchall()
        columns: list[ColumnInfo] = []

        for row in describe_res:
            col_name = str(row[0])
            col_type = str(row[1])

            try:
                samples = self.con.execute(
                    f'SELECT DISTINCT "{col_name}" FROM "{table_name}" WHERE "{col_name}" IS NOT NULL LIMIT 3;'
                ).fetchall()
                sample_vals = [s[0] for s in samples]
            except Exception:
                sample_vals = []

            try:
                nulls = self.con.execute(
                    f'SELECT COUNT(*) FROM "{table_name}" WHERE "{col_name}" IS NULL;'
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

        # Switch active table to most recently remaining table
        next_table = list(self.tables.keys())[-1]
        return self.activate_table(next_table)

    def get_loaded_tables_metadata(self) -> list[TableMetadata]:
        meta_list: list[TableMetadata] = []
        for t_name, info in self.tables.items():
            meta_list.append(
                TableMetadata(
                    table_name=t_name,
                    filename=info["filename"],
                    row_count=info["row_count"],
                    column_count=len(info["columns"]),
                    columns=[c.name for c in info["columns"]],
                )
            )
        return meta_list

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
                shared = set(cols1.keys()).intersection(set(cols2.keys()))
                for key_lower in shared:
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
        """Builds a comprehensive schema description of all loaded tables and join keys for the LLM."""
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
        """Executes a SQL query against DuckDB and returns (records, column_names)."""
        clean_query = query.strip().rstrip(";")
        wrapped_query = f"SELECT * FROM ({clean_query}) LIMIT {limit};"

        rel = self.con.execute(wrapped_query)
        col_names = [desc[0] for desc in rel.description]
        df = rel.df()
        records = df.to_dict(orient="records")
        return self._clean_records(records), col_names

    def _clean_records(self, records: list[dict[str, Any]]) -> list[dict[str, Any]]:
        cleaned = []
        for row in records:
            cleaned_row = {}
            for k, v in row.items():
                if pd.isna(v):
                    cleaned_row[k] = None
                elif hasattr(v, "isoformat"):
                    cleaned_row[k] = v.isoformat()
                else:
                    cleaned_row[k] = v
            cleaned.append(cleaned_row)
        return cleaned


dataset_manager = DatasetManager()
