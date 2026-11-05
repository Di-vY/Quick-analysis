# 📊 Data Analyst AI Helper

An AI-powered data analyst web application that lets users upload structured datasets (CSV, Excel, Parquet) and ask questions in natural language. Powered by **DuckDB** for deterministic in-memory SQL execution, **Google Gemini 2.0 Flash** for code synthesis and insight extraction, and **Next.js + Plotly** for interactive data visualizations.

---

## 🌟 Key Features

- **In-Memory Analytical Engine (DuckDB)**:
  - Instant SQL execution over uploaded files with near-zero latency.
  - No database installation or complex connection strings required.
- **Automated Data Profiling**:
  - Automatically identifies column names, data types, null counts, distinct sample values, and generates preview tables upon file upload.
- **Self-Healing SQL Agent (Gemini 2.0 Flash)**:
  - Translates natural language questions into valid DuckDB SQL queries.
  - If a SQL syntax error or column mismatch occurs, the agent automatically catches the traceback, sends it back to Gemini, fixes the query, and executes the corrected SQL transparently.
- **Interactive Visualizations (Plotly.js)**:
  - Renders interactive bar charts, time-series lines, scatter plots, and pie charts with zoom, pan, hover tooltips, and PNG export.
- **Auditability & Transparency**:
  - Expandable "DuckDB SQL Query" view for every answer.
  - Expandable tabular results view with a 1-click **Download CSV** button.
- **Smart Follow-Up Suggestions**:
  - Recommends 2–3 relevant follow-up questions tailored to your analytical context.

---

## 🏗️ Architecture

```
┌────────────────────────────────────────────────────────┐
│             Next.js / React UI (Frontend)             │
│  - Drag-and-drop CSV / Excel / Parquet uploader        │
│  - Dataset Schema Inspector & Column Explorer          │
│  - Interactive Chat Stream                             │
│  - Plotly Dynamic Charts                               │
│  - SQL Auditing Accordion & CSV Data Export            │
└───────────────────────────┬────────────────────────────┘
                            │ REST API (port 8000)
┌───────────────────────────▼────────────────────────────┐
│                  FastAPI (Backend)                     │
│  ┌──────────────────┐       ┌───────────────────────┐  │
│  │ Ingestion & EDA  │       │ LLM Analyst Engine    │  │
│  │ (Schema, Stats)  │       │ (Gemini 2.0 Flash)    │  │
│  └────────┬─────────┘       └───────────┬───────────┘  │
│           │                             │              │
│           ▼                             ▼              │
│  ┌──────────────────────────────────────────────────┐  │
│  │         DuckDB In-Memory SQL Engine              │  │
│  │   (Executes queries directly on CSV/Parquet)     │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start

### 1. Configure Your Gemini API Key
Get your free API key from [Google AI Studio](https://aistudio.google.com/app/apikey) and add it to `backend/.env`:

```env
GEMINI_API_KEY=AIzaSy...your_gemini_api_key_here
GEMINI_MODEL=gemini-2.0-flash
```

### 2. Launch the Application

#### Option A: One-Click Launch (Windows)
Double-click:
```
start.bat
```
This automatically starts both the FastAPI backend (`http://127.0.0.1:8000`) and the Next.js frontend (`http://localhost:3000`).

#### Option B: Manual Launch
1. **Start Backend**:
   ```bash
   cd backend
   venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
   ```

2. **Start Frontend**:
   ```bash
   cd frontend
   npm run dev
   ```

3. Open your browser at **[http://localhost:3000](http://localhost:3000)**.

---

## 💡 How to Use

1. **Load Data**:
   - Click **"Load Sample Sales Data"** for an instant demo with 15 rows of retail sales data, or
   - Drag and drop your own `.csv`, `.xlsx`, or `.parquet` file.
2. **Inspect the Schema**:
   - The left sidebar will display total rows, column data types, sample values, and null counts.
   - Click **"Preview First 5 Rows"** to view the raw table.
3. **Ask Questions**:
   - *"What is the total sales and profit by region?"*
   - *"Show the top 5 customers by revenue"*
   - *"Which product category has the highest profit margin?"*
4. **Interact with Results**:
   - Hover and zoom into the generated Plotly charts.
   - Expand the **DuckDB SQL Query** to audit the calculation.
   - Expand the **Query Results** table and click **CSV** to download the aggregated data.
   - Click any **Suggested Follow-up** chip to continue your exploration.

---

## 📁 Project Structure

```
DataAnalyst/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   └── routes.py         # Upload, chat, and SQL endpoints
│   │   ├── core/
│   │   │   ├── db.py             # DuckDB in-memory manager & profiler
│   │   │   ├── llm.py            # Gemini client & self-healing query agent
│   │   │   └── prompts.py        # System instructions & SQL-fixing prompts
│   │   ├── models/
│   │   │   └── schemas.py        # Pydantic request & response models
│   │   ├── config.py             # App settings & CORS configuration
│   │   └── main.py               # FastAPI application setup
│   ├── sample_data/
│   │   └── sales_data.csv        # Preloaded retail dataset
│   ├── uploads/                  # Uploaded files storage
│   ├── .env                      # API keys and environment variables
│   └── requirements.txt          # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx        # App layout & styling
│   │   │   └── page.tsx          # Main dashboard & interactive chat feed
│   │   ├── components/
│   │   │   ├── Sidebar.tsx       # File uploader & schema explorer
│   │   │   ├── DataChart.tsx     # Dynamic Plotly chart renderer
│   │   │   ├── QueryViewer.tsx   # SQL accordion & CSV exporter
│   │   │   └── PreviewModal.tsx  # Raw dataset table modal
│   │   ├── lib/
│   │   │   └── api.ts            # Frontend API client
│   │   └── types/
│   │       └── index.ts          # TypeScript interfaces
├── run_backend.bat               # Starts FastAPI
├── run_frontend.bat              # Starts Next.js
├── start.bat                     # Launches both services
└── README.md
```
