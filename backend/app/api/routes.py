import shutil
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, HTTPException
from app.config import UPLOAD_DIR
from app.core.db import dataset_manager
from app.core.llm import analyst_engine
from app.models.schemas import ChatRequest, ChatResponse, DatasetSummary

router = APIRouter()

@router.post("/upload", response_model=DatasetSummary)
async def upload_dataset(file: UploadFile = File(...)):
    """Uploads a CSV, Excel, or Parquet file, loads it into DuckDB, and returns summary."""
    filename = file.filename or "dataset.csv"
    ext = Path(filename).suffix.lower()

    if ext not in [".csv", ".xlsx", ".xls", ".parquet"]:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format '{ext}'. Supported formats: .csv, .xlsx, .xls, .parquet"
        )

    # Save to local disk
    save_path = UPLOAD_DIR / filename
    try:
        with open(save_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")

    # Ingest into DuckDB
    try:
        summary = dataset_manager.load_file(save_path, filename)
        summary.suggested_questions = analyst_engine.generate_starter_questions(summary)
        return summary
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse and profile dataset: {str(e)}")

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
    history_dicts = [{"role": m.role, "content": m.content} for m in req.history]

    response = analyst_engine.analyze_query(
        user_message=req.message,
        summary=summary,
        history=history_dicts
    )
    return response

@router.post("/query/sql")
async def execute_raw_sql(body: dict):
    """Executes a direct raw SQL query against the active DuckDB table (for auditing or manual SQL)."""
    sql = body.get("sql")
    if not sql:
        raise HTTPException(status_code=400, detail="Missing 'sql' query parameter.")
    if not dataset_manager.active_dataset_id:
        raise HTTPException(status_code=400, detail="No active dataset loaded.")
    
    try:
        records, cols = dataset_manager.execute_query(sql)
        return {"columns": cols, "rows": records, "count": len(records)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
