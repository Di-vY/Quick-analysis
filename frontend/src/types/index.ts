export interface ColumnInfo {
  name: string;
  data_type: string;
  sample_values: any[];
  null_count: number;
}

export interface TableMetadata {
  table_name: string;
  filename: string;
  row_count: number;
  column_count: number;
  columns: string[];
}

export interface DatasetSummary {
  dataset_id: string;
  table_name?: string;
  filename: string;
  row_count: number;
  column_count: number;
  columns: ColumnInfo[];
  preview_rows: Record<string, any>[];
  suggested_questions?: string[];
  loaded_tables?: TableMetadata[];
}

export interface ChartSpec {
  chart_type: 'bar' | 'line' | 'scatter' | 'pie' | 'histogram' | 'none';
  title: string;
  x_column?: string;
  y_column?: string;
  color_column?: string;
  data?: Record<string, any>[];
}

export interface ChatResponse {
  answer: string;
  sql_query?: string | null;
  query_result?: Record<string, any>[] | null;
  chart?: ChartSpec | null;
  suggestions: string[];
  error?: string | null;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sql_query?: string | null;
  query_result?: Record<string, any>[] | null;
  chart?: ChartSpec | null;
  suggestions?: string[];
  error?: string | null;
  timestamp: string;
}
