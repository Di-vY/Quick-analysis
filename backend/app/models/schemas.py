from typing import Any, Optional
from pydantic import BaseModel, Field

class ColumnInfo(BaseModel):
    name: str
    data_type: str
    sample_values: list[Any] = []
    null_count: int = 0

class TableMetadata(BaseModel):
    table_name: str
    filename: str
    row_count: int
    column_count: int
    columns: list[str] = Field(default_factory=list)

class DatasetSummary(BaseModel):
    dataset_id: str
    table_name: str = "data_table"
    filename: str
    row_count: int
    column_count: int
    columns: list[ColumnInfo]
    preview_rows: list[dict[str, Any]]
    suggested_questions: list[str] = Field(default_factory=list)
    loaded_tables: list[TableMetadata] = Field(default_factory=list)

class ChatMessage(BaseModel):
    role: str = Field(pattern=r"^(user|assistant)$")
    content: str = Field(max_length=20_000)

class ChatRequest(BaseModel):
    dataset_id: str = Field(max_length=200)
    message: str = Field(min_length=1, max_length=2_000)
    history: list[ChatMessage] = Field(default_factory=list, max_length=20)

class SqlQueryRequest(BaseModel):
    sql: str = Field(min_length=1, max_length=10_000)

class ChartSpec(BaseModel):
    chart_type: str = "none" # "bar", "line", "scatter", "pie", "histogram", "none"
    title: str = ""
    x_column: Optional[str] = None
    y_column: Optional[str] = None
    color_column: Optional[str] = None
    data: Optional[list[dict[str, Any]]] = None

class ChatResponse(BaseModel):
    answer: str
    sql_query: Optional[str] = None
    query_result: Optional[list[dict[str, Any]]] = None
    chart: Optional[ChartSpec] = None
    suggestions: list[str] = Field(default_factory=list)
    error: Optional[str] = None
