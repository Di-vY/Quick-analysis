import json
import logging
import os
import re
from typing import Any
import httpx
from app.config import settings
from app.core.db import dataset_manager
from app.core.prompts import SYSTEM_ANALYST_PROMPT, SQL_FIX_PROMPT
from app.models.schemas import ChatResponse, ChartSpec, DatasetSummary

logger = logging.getLogger(__name__)

# Ordered by highest reliability and lowest latency (verified 200 OK)
FALLBACK_MODELS = [
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-3.8-flash",
]


class LLMAnalystEngine:
    """Handles LLM interaction, SQL generation, self-healing execution, and chart formulation."""

    def _get_api_key(self) -> str:
        api_key = settings.GEMINI_API_KEY or os.getenv("GEMINI_API_KEY", "")
        if not api_key:
            raise ValueError("GEMINI_API_KEY is not configured. Please set it in backend/.env")
        return api_key

    def _clean_json_response(self, text: str) -> str:
        """Strip markdown fences if present."""
        text = text.strip()
        match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
        if match:
            return match.group(1).strip()
        # Extract first {...} block if extra text is present
        brace_match = re.search(r"(\{[\s\S]*\})", text)
        if brace_match:
            return brace_match.group(1).strip()
        return text

    def _call_gemini_with_fallback(self, contents: str, system_instruction: str = None) -> str:
        """Calls Gemini REST API directly via httpx for fast model failover without 45s tenacity stalls."""
        api_key = self._get_api_key()
        models_to_try = [settings.GEMINI_MODEL] + [
            m for m in FALLBACK_MODELS if m != settings.GEMINI_MODEL
        ]
        last_error = None

        full_prompt = f"{system_instruction}\n\n{contents}" if system_instruction else contents
        payload: dict[str, Any] = {
            "contents": [{"parts": [{"text": full_prompt}]}],
            "generationConfig": {
                "temperature": 0.1,
            },
        }

        with httpx.Client(timeout=6.0) as http_client:
            for model_name in models_to_try[:3]:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
                try:
                    resp = http_client.post(url, json=payload)
                    if resp.status_code == 200:
                        data = resp.json()
                        candidates = data.get("candidates", [])
                        if candidates:
                            parts = candidates[0].get("content", {}).get("parts", [])
                            if parts and "text" in parts[0]:
                                return parts[0]["text"]
                    else:
                        err_text = resp.text[:160]
                        logger.warning(
                            f"Model '{model_name}' returned HTTP {resp.status_code}: {err_text}. Trying next fallback..."
                        )
                        last_error = RuntimeError(f"HTTP {resp.status_code}: {err_text}")
                        if resp.status_code in (400, 403) and "API_KEY_INVALID" in resp.text:
                            raise ValueError("Invalid GEMINI_API_KEY in backend/.env")
                except ValueError:
                    raise
                except Exception as e:
                    logger.warning(f"Model '{model_name}' request failed ({e}). Trying next fallback...")
                    last_error = e
                    continue

        if last_error:
            raise last_error
        raise RuntimeError("All Gemini models are currently unavailable.")

    def generate_starter_questions(self, summary: DatasetSummary) -> list[str]:
        """Generates 3-4 tailored starter questions instantaneously from the dataset's actual schema."""
        numeric_cols = [
            c.name
            for c in summary.columns
            if any(
                t in c.data_type.lower()
                for t in ["int", "double", "float", "decimal", "numeric", "real", "hugeint"]
            )
        ]
        cat_cols = [
            c.name
            for c in summary.columns
            if any(t in c.data_type.lower() for t in ["varchar", "text", "str", "char"])
            and not any(id_kw in c.name.lower() for id_kw in ["id", "uuid", "code"])
        ]
        if not cat_cols:
            cat_cols = [
                c.name
                for c in summary.columns
                if any(t in c.data_type.lower() for t in ["varchar", "text", "str", "char"])
            ]
        date_cols = [
            c.name
            for c in summary.columns
            if any(t in c.data_type.lower() for t in ["date", "time"])
            or "date" in c.name.lower()
        ]

        questions: list[str] = []
        joins = dataset_manager.find_joinable_columns()
        if joins:
            j = joins[0]
            questions.append(
                f"Join {j['left_table']} and {j['right_table']} on {j['left_col']} to compare metrics"
            )

        if numeric_cols and cat_cols:
            questions.append(f"What is the total {numeric_cols[0]} by {cat_cols[0]}?")
            if len(cat_cols) > 1:
                questions.append(f"Show top 5 {cat_cols[1]} by {numeric_cols[0]}")
            else:
                questions.append(f"Show top 5 {cat_cols[0]} by {numeric_cols[0]}")
        if len(numeric_cols) >= 2 and cat_cols:
            questions.append(
                f"Which {cat_cols[-1]} has the highest {numeric_cols[1]}?"
            )
        elif date_cols and numeric_cols:
            questions.append(f"How does {numeric_cols[0]} trend over {date_cols[0]}?")
        elif cat_cols:
            questions.append(f"How many unique {cat_cols[0]} are there?")

        if not questions:
            questions = [
                f"Show the first 10 rows of {summary.filename}",
                "Summarize all columns in this dataset",
                "Are there any missing values in this data?",
            ]

        return questions[:3]

    def analyze_query(
        self, user_message: str, summary: DatasetSummary, history: list[dict] = None
    ) -> ChatResponse:
        """Translates user prompt into SQL, executes it on DuckDB, and returns explanation + charts."""
        try:
            self._get_api_key()
        except ValueError as e:
            return ChatResponse(
                answer="⚠️ **Gemini API Key Missing**: Please set `GEMINI_API_KEY` in `backend/.env` to start analyzing data.",
                error=str(e),
                suggestions=self.generate_starter_questions(summary),
            )

        # Build multi-table schema context
        schema_context = dataset_manager.get_all_tables_schema_context()
        sample_rows_json = json.dumps(summary.preview_rows[:3], default=str, indent=2)

        system_instruction = SYSTEM_ANALYST_PROMPT.format(
            schema_context=schema_context, sample_rows=sample_rows_json
        )

        # Build conversation contents
        prompt_content = f"User Question: {user_message}"
        if history and len(history) > 0:
            history_text = "\n".join(
                [f"{msg['role'].upper()}: {msg['content']}" for msg in history[-4:]]
            )
            prompt_content = f"Recent Conversation Context:\n{history_text}\n\nCurrent Question: {user_message}"

        try:
            raw_text = self._call_gemini_with_fallback(prompt_content, system_instruction)
            cleaned = self._clean_json_response(raw_text)
            parsed = json.loads(cleaned)
        except Exception as e:
            logger.warning(f"Cloud LLM unavailable ({e}); activating local DuckDB SQL analyzer fallback.")
            return self._local_nl_to_sql_fallback(user_message, summary)

        sql_query = parsed.get("sql_query")
        explanation = parsed.get("explanation", "Here is what I found in your data:")
        chart_dict = parsed.get("chart", {})
        suggestions = parsed.get("suggestions") or self.generate_starter_questions(summary)

        if not sql_query:
            return ChatResponse(answer=explanation, suggestions=suggestions)

        # Execute SQL on DuckDB
        records, col_names, executed_sql, error = self._execute_with_self_healing(
            sql_query, schema_context
        )

        if error:
            logger.warning(f"SQL execution failed ({error}); falling back to local DuckDB SQL analyzer.")
            return self._local_nl_to_sql_fallback(user_message, summary)

        # Build chart object if chart recommended
        chart_spec = None
        chart_type = chart_dict.get("chart_type", "none")
        if chart_type and chart_type != "none" and len(records) > 0:
            x_col = chart_dict.get("x_column")
            y_col = chart_dict.get("y_column")
            title = chart_dict.get("title", "Data Visualization")

            # Fallback to first 2 columns of query result if column names differed slightly
            if x_col not in records[0] and len(col_names) >= 1:
                x_col = col_names[0]
            if y_col and y_col not in records[0] and len(col_names) >= 2:
                y_col = col_names[1]

            if x_col in records[0] and (y_col is None or y_col in records[0]):
                chart_spec = ChartSpec(
                    chart_type=chart_type,
                    title=title,
                    x_column=x_col,
                    y_column=y_col,
                    data=records[:50],
                )

        return ChatResponse(
            answer=explanation,
            sql_query=executed_sql,
            query_result=records[:100],
            chart=chart_spec,
            suggestions=suggestions,
        )

    def _execute_with_self_healing(
        self, sql_query: str, schema_context: str
    ) -> tuple[list[dict], list[str], str, str | None]:
        """Tries to execute SQL. If it fails, asks LLM to fix the query once."""
        try:
            records, cols = dataset_manager.execute_query(sql_query)
            return records, cols, sql_query, None
        except Exception as first_err:
            err_msg = str(first_err)
            logger.warning(
                f"SQL failed: {sql_query}. Error: {err_msg}. Attempting self-healing fix..."
            )
            try:
                fix_prompt = SQL_FIX_PROMPT.format(
                    original_query=sql_query,
                    error_message=err_msg,
                    schema_context=schema_context,
                )
                fixed_raw = self._call_gemini_with_fallback(fix_prompt)
                fixed_json = json.loads(self._clean_json_response(fixed_raw))
                corrected_sql = fixed_json.get("sql_query")

                if corrected_sql:
                    records, cols = dataset_manager.execute_query(corrected_sql)
                    return records, cols, corrected_sql, None
            except Exception as second_err:
                logger.error(f"Self-healing fix failed: {second_err}")

            return [], [], sql_query, err_msg

    def _local_nl_to_sql_fallback(
        self, user_message: str, summary: DatasetSummary
    ) -> ChatResponse:
        """Deterministic DuckDB SQL generator when Gemini API is experiencing 503 high demand."""
        q_lower = user_message.lower()

        # Check if user is asking for a multi-table JOIN and we have joinable columns
        joins = dataset_manager.find_joinable_columns()
        if ("join" in q_lower or "compare" in q_lower or "target" in q_lower) and joins:
            j = joins[0]
            t1, t2 = j["left_table"], j["right_table"]
            c1, c2 = j["left_col"], j["right_col"]
            t1_nums = [
                c.name
                for c in dataset_manager.tables[t1]["columns"]
                if any(t in c.data_type.lower() for t in ["int", "double", "float", "decimal", "numeric"])
                and c.name != c1
            ]
            t2_nums = [
                c.name
                for c in dataset_manager.tables[t2]["columns"]
                if any(t in c.data_type.lower() for t in ["int", "double", "float", "decimal", "numeric"])
                and c.name != c2
            ]
            if t1_nums and t2_nums:
                n1, n2 = t1_nums[0], t2_nums[0]
                sql = (
                    f'SELECT a."{c1}", ROUND(SUM(a."{n1}"), 2) AS "Total_{n1}", '
                    f'ROUND(AVG(b."{n2}"), 2) AS "{n2}" '
                    f'FROM "{t1}" a JOIN "{t2}" b ON a."{c1}" = b."{c2}" '
                    f'GROUP BY a."{c1}" ORDER BY "Total_{n1}" DESC LIMIT 20'
                )
            else:
                sql = f'SELECT a.*, b.* FROM "{t1}" a JOIN "{t2}" b ON a."{c1}" = b."{c2}" LIMIT 25'
            try:
                records, cols = dataset_manager.execute_query(sql)
                chart_spec = None
                if records and len(cols) >= 2:
                    chart_spec = ChartSpec(
                        chart_type="bar",
                        title=f"Joined {t1} & {t2} by {c1}",
                        x_column=cols[0],
                        y_column=cols[1],
                        data=records[:50],
                    )
                return ChatResponse(
                    answer=f"Executed a relational **SQL JOIN** between **`{t1}`** and **`{t2}`** on key **`{c1}`** ({len(records)} rows returned).",
                    sql_query=sql,
                    query_result=records[:100],
                    chart=chart_spec,
                    suggestions=self.generate_starter_questions(summary),
                )
            except Exception:
                pass

        numeric_cols = [
            c.name
            for c in summary.columns
            if any(
                t in c.data_type.lower()
                for t in ["int", "double", "float", "decimal", "numeric", "real", "hugeint"]
            )
        ]
        cat_cols = [
            c.name
            for c in summary.columns
            if any(t in c.data_type.lower() for t in ["varchar", "text", "str", "char"])
        ]

        # Match columns mentioned in user prompt
        matched_cats = [
            c for c in cat_cols if c.lower().replace("_", " ") in q_lower or c.lower() in q_lower
        ]
        if not matched_cats:
            if "customer" in q_lower:
                matched_cats = [c for c in cat_cols if "customer" in c.lower() or "name" in c.lower()]
            elif "category" in q_lower or "categories" in q_lower:
                matched_cats = [c for c in cat_cols if "cat" in c.lower()]
            elif "region" in q_lower:
                matched_cats = [c for c in cat_cols if "region" in c.lower()]

        matched_nums = [
            c for c in numeric_cols if c.lower().replace("_", " ") in q_lower or c.lower() in q_lower
        ]
        if not matched_nums:
            if "revenue" in q_lower or "sales" in q_lower:
                matched_nums = [c for c in numeric_cols if "sale" in c.lower() or "rev" in c.lower()]
            elif "profit" in q_lower or "margin" in q_lower:
                matched_nums = [c for c in numeric_cols if "profit" in c.lower()]

        target_cat = (
            matched_cats[0]
            if matched_cats
            else (
                next(
                    (c for c in cat_cols if not any(k in c.lower() for k in ["id", "code"])),
                    cat_cols[0] if cat_cols else summary.columns[0].name,
                )
            )
        )
        target_num = (
            matched_nums[0]
            if matched_nums
            else (numeric_cols[0] if numeric_cols else None)
        )

        # Extract top N if requested
        top_match = re.search(r"top\s+(\d+)", q_lower)
        limit_val = int(top_match.group(1)) if top_match else 15

        if ("how many" in q_lower or "count" in q_lower or "unique" in q_lower) and target_cat:
            sql = (
                f'SELECT "{target_cat}", COUNT(*) AS "Record_Count"'
                + (f', ROUND(SUM("{target_num}"), 2) AS "Total_{target_num}"' if target_num else "")
                + f' FROM data_table GROUP BY "{target_cat}" ORDER BY "Record_Count" DESC LIMIT {limit_val}'
            )
            y_col = f"Total_{target_num}" if target_num else "Record_Count"
            chart_title = f"Breakdown by {target_cat}"
        elif target_num and target_cat:
            agg_fn = "AVG" if ("average" in q_lower or "avg" in q_lower) else "SUM"
            alias = f"{'Avg' if agg_fn == 'AVG' else 'Total'}_{target_num}"
            sql = (
                f'SELECT "{target_cat}", ROUND({agg_fn}("{target_num}"), 2) AS "{alias}", COUNT(*) AS "Count" '
                f'FROM data_table GROUP BY "{target_cat}" ORDER BY "{alias}" DESC LIMIT {limit_val}'
            )
            y_col = alias
            chart_title = f"{alias.replace('_', ' ')} by {target_cat}"
        else:
            sql = f"SELECT * FROM data_table LIMIT {limit_val}"
            y_col = None
            chart_title = f"Preview of {summary.filename}"

        try:
            records, cols = dataset_manager.execute_query(sql)
            if records and target_cat in records[0]:
                distinct_cnt = len(records)
                top_item = records[0].get(target_cat)
                top_val = records[0].get(y_col) if y_col else None
                if top_val is not None:
                    explanation = (
                        f"Found **{distinct_cnt} distinct `{target_cat}` groups** in **{summary.filename}**. "
                        f"The leading group is **{top_item}** with **{y_col.replace('_', ' ')}** of **{top_val:,}**."
                    )
                else:
                    explanation = f"Found **{distinct_cnt} distinct `{target_cat}` values** in **{summary.filename}**."
            else:
                explanation = f"Executed DuckDB query across **{summary.filename}** ({len(records)} rows returned)."

            chart_spec = None
            if records and y_col and target_cat in records[0] and y_col in records[0]:
                chart_spec = ChartSpec(
                    chart_type="bar",
                    title=chart_title,
                    x_column=target_cat,
                    y_column=y_col,
                    data=records[:50],
                )

            return ChatResponse(
                answer=explanation,
                sql_query=sql,
                query_result=records[:100],
                chart=chart_spec,
                suggestions=self.generate_starter_questions(summary),
            )
        except Exception as e:
            return ChatResponse(
                answer=f"Could not process query: {e}",
                error=str(e),
                suggestions=self.generate_starter_questions(summary),
            )


analyst_engine = LLMAnalystEngine()
