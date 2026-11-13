import re
import uuid
from pathlib import Path
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from app.config import UPLOAD_DIR, settings
from app.core.db import dataset_manager
from app.core.llm import analyst_engine
from app.core.security import UnsafeQueryError, require_access_key
from app.models.schemas import ChatRequest, ChatResponse, DatasetSummary, SqlQueryRequest

router = APIRouter(dependencies=[Depends(require_access_key)])

ALLOWED_EXTENSIONS = {".csv", ".xlsx", ".xls", ".parquet"}
_CHUNK_SIZE = 1024 * 1024  # 1 MB


def _safe_display_name(raw_name: str) -> str:
    """Strips any client-supplied directory components and unsafe characters."""
    base = re.split(r"[\\/]", raw_name or "")[-1]
    base = re.sub(r"[^\w.\- ]", "_", base).strip(" .")
    return base[:120] or "dataset.csv"


@router.post("/upload", response_model=DatasetSummary)
async def upload_dataset(file: UploadFile = File(...)):
    """Uploads a CSV, Excel, or Parquet file, loads it into DuckDB, and returns summary."""
    display_name = _safe_display_name(file.filename or "dataset.csv")
    ext = Path(display_name).suffix.lower()

    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format '{ext}'. Supported formats: .csv, .xlsx, .xls, .parquet",
        )

    max_bytes = settings.MAX_UPLOAD_MB * 1024 * 1024
    # Server-generated name: never trust the client filename for the storage path.
    save_path = UPLOAD_DIR / f"{uuid.uuid4().hex}{ext}"
    total = 0

    try:
        with open(save_path, "wb") as buffer:
            while chunk := await file.read(_CHUNK_SIZE):
                total += len(chunk)
                if total > max_bytes:
                    raise HTTPException(
                        status_code=413,
                        detail=f"File is too large. Maximum upload size is {settings.MAX_UPLOAD_MB} MB.",
                    )
                buffer.write(chunk)
    except HTTPException:
        save_path.unlink(missing_ok=True)
        raise
    except Exception:
        save_path.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail="Failed to save the uploaded file.")

    if total == 0:
        save_path.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")

    try:
        summary = dataset_manager.load_file(save_path, display_name)
        summary.suggested_questions = analyst_engine.generate_starter_questions(summary)
        return summary
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Failed to parse the dataset. Check that the file is a valid CSV, Excel, or Parquet file.",
        )
    finally:
        # Data now lives in DuckDB memory; remove the raw file from disk.
        save_path.unlink(missing_ok=True)


@router.get("/dataset/current", response_model=DatasetSummary)
async def get_current_dataset():
    """Returns the current loaded dataset schema and preview."""
    if not dataset_manager.active_dataset_id:
        raise HTTPException(status_code=404, detail="No dataset has been uploaded yet.")
    summary = dataset_manager.get_summary()
    summary.suggested_questions = analyst_engine.generate_starter_questions(summary)
    return summary


@router.post("/tables/{table_name}/activate", response_model=DatasetSummary)
async def activate_table(table_name: str):
    """Switches the active DuckDB table (`data_table` alias) and returns its DatasetSummary."""
    try:
        summary = dataset_manager.activate_table(table_name)
        summary.suggested_questions = analyst_engine.generate_starter_questions(summary)
        return summary
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/tables/{table_name}")
async def delete_table(table_name: str):
    """Removes a table from DuckDB and returns the updated active DatasetSummary (or null if empty)."""
    try:
        summary = dataset_manager.remove_table(table_name)
        if summary:
            summary.suggested_questions = analyst_engine.generate_starter_questions(summary)
        return {"active_dataset": summary}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/chat", response_model=ChatResponse)
async def chat_with_data(req: ChatRequest):
    """Answers user question using SQL generation against DuckDB and returns insights + charts."""
    if not dataset_manager.active_dataset_id:
        raise HTTPException(status_code=400, detail="Please upload a dataset first before asking questions.")

    summary = dataset_manager.get_summary()
    history_dicts = [{"role": m.role, "content": m.content[:2_000]} for m in req.history[-6:]]

    return analyst_engine.analyze_query(
        user_message=req.message,
        summary=summary,
        history=history_dicts,
    )


@router.post("/query/sql")
async def execute_raw_sql(body: SqlQueryRequest):
    """Executes a validated, read-only SQL query against the loaded DuckDB tables."""
    if not dataset_manager.active_dataset_id:
        raise HTTPException(status_code=400, detail="No active dataset loaded.")

    try:
        records, cols = dataset_manager.execute_query(body.sql)
        return {"columns": cols, "rows": records, "count": len(records)}
    except UnsafeQueryError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except TimeoutError as e:
        raise HTTPException(status_code=408, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
