'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Play, Download, Terminal, Database, Clock, Sparkles, GitMerge } from 'lucide-react';
import { DatasetSummary } from '@/types';

interface SqlWorkspaceViewProps {
  dataset: DatasetSummary | null;
  theme: 'light' | 'dark';
}

export const SqlWorkspaceView: React.FC<SqlWorkspaceViewProps> = ({ dataset, theme }) => {
  const loadedTables = dataset?.loaded_tables || [];

  const templates = useMemo(() => {
    if (!dataset || !dataset.columns || dataset.columns.length === 0) {
      return [
        {
          label: 'Preview 10 Rows',
          query: 'SELECT * FROM data_table LIMIT 10;',
          isJoin: false,
        },
      ];
    }

    const activeTable = dataset.table_name || 'data_table';

    const numCols = dataset.columns
      .filter((c) =>
        ['int', 'double', 'float', 'decimal', 'numeric', 'real', 'hugeint'].some((t) =>
          c.data_type.toLowerCase().includes(t)
        )
      )
      .map((c) => c.name);

    const catCols = dataset.columns
      .filter((c) =>
        ['varchar', 'text', 'str', 'char'].some((t) => c.data_type.toLowerCase().includes(t))
      )
      .map((c) => c.name);

    const list: { label: string; query: string; isJoin?: boolean }[] = [];

    // Check for multi-table JOIN opportunities first!
    if (loadedTables.length >= 2) {
      for (let i = 0; i < loadedTables.length; i++) {
        for (let j = i + 1; j < loadedTables.length; j++) {
          const t1 = loadedTables[i];
          const t2 = loadedTables[j];
          const sharedCol = t1.columns.find((c1) =>
            t2.columns.some((c2) => c2.toLowerCase() === c1.toLowerCase())
          );
          if (sharedCol) {
            const t2MatchCol =
              t2.columns.find((c2) => c2.toLowerCase() === sharedCol.toLowerCase()) || sharedCol;
            list.push({
              label: `JOIN ${t1.table_name} ⋈ ${t2.table_name} (${sharedCol})`,
              query: `SELECT a.*, b.*\nFROM "${t1.table_name}" a\nINNER JOIN "${t2.table_name}" b\n  ON a."${sharedCol}" = b."${t2MatchCol}"\nLIMIT 25;`,
              isJoin: true,
            });
            list.push({
              label: `Group JOIN by ${sharedCol}`,
              query: `SELECT\n  a."${sharedCol}",\n  COUNT(*) AS Matched_Rows\nFROM "${t1.table_name}" a\nLEFT JOIN "${t2.table_name}" b\n  ON a."${sharedCol}" = b."${t2MatchCol}"\nGROUP BY a."${sharedCol}"\nORDER BY Matched_Rows DESC;`,
              isJoin: true,
            });
          }
        }
      }
    }

    list.push({
      label: `Preview ${activeTable}`,
      query: `SELECT * FROM "${activeTable}" LIMIT 10;`,
      isJoin: false,
    });

    if (catCols.length > 0 && numCols.length > 0) {
      const cat = catCols[0];
      const num = numCols[0];
      list.push({
        label: `${num} by ${cat}`,
        query: `SELECT "${cat}", COUNT(*) AS Record_Count, ROUND(SUM("${num}"), 2) AS Total\nFROM "${activeTable}"\nGROUP BY "${cat}"\nORDER BY Total DESC;`,
        isJoin: false,
      });
    } else if (catCols.length > 0) {
      const cat = catCols[0];
      list.push({
        label: `Count by ${cat}`,
        query: `SELECT "${cat}", COUNT(*) AS Record_Count\nFROM "${activeTable}"\nGROUP BY "${cat}"\nORDER BY Record_Count DESC;`,
        isJoin: false,
      });
    }

    if (numCols.length > 0) {
      const num = numCols[0];
      list.push({
        label: `Top 5 by ${num}`,
        query: `SELECT *\nFROM "${activeTable}"\nORDER BY "${num}" DESC\nLIMIT 5;`,
        isJoin: false,
      });
    }

    return list;
  }, [dataset, loadedTables]);

  const [sql, setSql] = useState(templates[0]?.query || 'SELECT * FROM data_table LIMIT 10;');
  const [results, setResults] = useState<any[] | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [execTime, setExecTime] = useState<number | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (templates.length > 0) {
      setSql(templates[0].query);
    }
    setResults(null);
    setError(null);
  }, [dataset, templates]);

  const handleRunQuery = async () => {
    if (!sql.trim() || isRunning) return;
    setIsRunning(true);
    setError(null);
    const startTime = performance.now();

    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const res = await fetch(`${apiBase}/api/query/sql`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'SQL Query execution failed');
      }

      setColumns(data.columns || []);
      setResults(data.rows || []);
      setExecTime(Math.round(performance.now() - startTime));
    } catch (err: any) {
      setError(err.message || 'Execution error');
      setResults(null);
    } finally {
      setIsRunning(false);
    }
  };

  const handleExportCsv = () => {
    if (!results || results.length === 0) return;
    const headers = columns;
    const csvRows = [
      headers.join(','),
      ...results.map((r) =>
        headers
          .map((h) => {
            const val = r[h] === null || r[h] === undefined ? '' : String(r[h]);
            return `"${val.replace(/"/g, '""')}"`;
          })
          .join(',')
      ),
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'query_output.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden p-6 space-y-4">
      {/* Workspace Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div>
          <h3
            className={`text-base font-bold flex items-center gap-2 ${
              theme === 'light' ? 'text-slate-900' : 'text-white'
            }`}
          >
            <Terminal className="w-5 h-5 text-blue-500" />
            <span>Interactive SQL & Multi-Table Join Workspace</span>
          </h3>
          <p className="text-xs text-slate-500">
            Write standard DuckDB SQL across any loaded table or use{' '}
            <code className="font-mono text-blue-500">data_table</code> for the active table
          </p>
        </div>

        {/* Quick Query & JOIN Templates */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] text-slate-400 font-medium mr-1 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-500" />
            <span>Templates:</span>
          </span>
          {templates.map((t, idx) => (
            <button
              key={idx}
              onClick={() => setSql(t.query)}
              className={`text-[11px] px-2.5 py-1 rounded-md border transition flex items-center gap-1 ${
                t.isJoin
                  ? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-500/20 font-semibold'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 hover:bg-blue-50 hover:border-blue-400 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              {t.isJoin && <GitMerge className="w-3 h-3" />}
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Multi-Table Schema Reference Strip */}
      {loadedTables.length > 0 && (
        <div
          className={`p-3 rounded-xl border text-xs flex flex-col gap-2 ${
            theme === 'light'
              ? 'bg-slate-50 border-slate-200 text-slate-700'
              : 'bg-[#0b142c] border-slate-800 text-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-blue-500" />
              <span>Available DuckDB Tables & Columns (Click to insert into SQL)</span>
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            {loadedTables.map((tbl) => (
              <div key={tbl.table_name} className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setSql((prev) => `${prev} "${tbl.table_name}"`)}
                  className="font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded hover:bg-blue-500/20 transition"
                  title="Click to insert table name"
                >
                  {tbl.table_name} ({tbl.row_count})
                </button>
                <span className="text-slate-400">:</span>
                <div className="flex items-center gap-1 flex-wrap">
                  {tbl.columns.map((col) => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => setSql((prev) => `${prev} "${col}"`)}
                      className={`font-mono text-[11px] px-1.5 py-0.5 rounded border transition ${
                        theme === 'light'
                          ? 'bg-white border-slate-200 hover:border-blue-400 text-slate-600'
                          : 'bg-slate-900 border-slate-800 hover:border-blue-500 text-slate-300'
                      }`}
                      title={`Insert column "${col}"`}
                    >
                      {col}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SQL Code Input */}
      <div className="relative rounded-xl border border-slate-300 dark:border-slate-800 overflow-hidden shadow-sm">
        <textarea
          value={sql}
          onChange={(e) => setSql(e.target.value)}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
              e.preventDefault();
              handleRunQuery();
            }
          }}
          rows={5}
          placeholder="SELECT * FROM data_table LIMIT 10;"
          className={`w-full p-4 font-mono text-xs resize-none focus:outline-none focus:ring-1 focus:ring-blue-500 ${
            theme === 'light'
              ? 'bg-slate-900 text-emerald-400 placeholder:text-slate-500'
              : 'bg-[#060e20] text-emerald-400 placeholder:text-slate-600'
          }`}
        />
        <div className="absolute right-3 bottom-3 flex items-center gap-2">
          <span className="text-[10px] text-slate-500 hidden sm:inline">Ctrl + Enter to run</span>
          <button
            onClick={handleRunQuery}
            disabled={isRunning || !sql.trim()}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-semibold shadow-md transition"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{isRunning ? 'Executing...' : 'Run Query'}</span>
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-mono">
          {error}
        </div>
      )}

      {/* Query Results Table */}
      <div className="flex-1 flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="h-10 px-4 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              Query Results {results ? `(${results.length} rows)` : ''}
            </span>
            {execTime !== null && (
              <span className="text-[11px] text-emerald-500 font-mono flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>{execTime}ms</span>
              </span>
            )}
          </div>
          {results && results.length > 0 && (
            <button
              onClick={handleExportCsv}
              className="flex items-center gap-1 text-[11px] font-medium text-blue-500 hover:text-blue-600"
            >
              <Download className="w-3 h-3" />
              <span>Download CSV</span>
            </button>
          )}
        </div>

        <div className="flex-1 overflow-auto">
          {results && results.length > 0 ? (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 font-semibold sticky top-0 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-2.5 w-12 text-slate-400">#</th>
                  {columns.map((col) => (
                    <th key={col} className="px-4 py-2.5 font-mono whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono">
                {results.map((row, idx) => (
                  <tr
                    key={idx}
                    className={`transition-colors ${
                      theme === 'light'
                        ? 'hover:bg-slate-50 text-slate-700'
                        : 'hover:bg-slate-800/40 text-slate-300'
                    }`}
                  >
                    <td className="px-4 py-2 text-slate-400">{idx + 1}</td>
                    {columns.map((col) => (
                      <td key={col} className="px-4 py-2 whitespace-nowrap">
                        {row[col] === null ? (
                          <span className="text-slate-400 italic">null</span>
                        ) : (
                          String(row[col])
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400 text-xs">
              Run a query above to see live results from DuckDB.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
