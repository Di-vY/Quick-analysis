'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Copy, Check, Table, Terminal, Download } from 'lucide-react';

interface QueryViewerProps {
  sqlQuery?: string | null;
  queryResult?: Record<string, any>[] | null;
}

export const QueryViewer: React.FC<QueryViewerProps> = ({ sqlQuery, queryResult }) => {
  const [showSql, setShowSql] = useState(false);
  const [showTable, setShowTable] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!sqlQuery && (!queryResult || queryResult.length === 0)) {
    return null;
  }

  const handleCopySql = () => {
    if (!sqlQuery) return;
    navigator.clipboard.writeText(sqlQuery);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportCsv = () => {
    if (!queryResult || queryResult.length === 0) return;
    const headers = Object.keys(queryResult[0]);
    const csvRows = [
      headers.join(','),
      ...queryResult.map((row) =>
        headers
          .map((h) => {
            const val = row[h] === null || row[h] === undefined ? '' : String(row[h]);
            return `"${val.replace(/"/g, '""')}"`;
          })
          .join(',')
      ),
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'query_result.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const columns = queryResult && queryResult.length > 0 ? Object.keys(queryResult[0]) : [];

  return (
    <div className="mt-3 space-y-2 text-xs">
      {/* SQL Toggle */}
      {sqlQuery && (
        <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950/70">
          <div
            onClick={() => setShowSql(!showSql)}
            className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-slate-900/60 transition-colors"
          >
            <div className="flex items-center gap-2 text-slate-300 font-mono">
              <Terminal className="w-3.5 h-3.5 text-emerald-400" />
              <span>DuckDB SQL Query</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopySql();
                }}
                className="p-1 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded"
                title="Copy SQL"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              {showSql ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
            </div>
          </div>

          {showSql && (
            <div className="p-3 bg-slate-950 border-t border-slate-800 font-mono text-emerald-300 overflow-x-auto whitespace-pre-wrap leading-relaxed">
              {sqlQuery}
            </div>
          )}
        </div>
      )}

      {/* Query Result Table Toggle */}
      {queryResult && queryResult.length > 0 && (
        <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950/70">
          <div
            onClick={() => setShowTable(!showTable)}
            className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-slate-900/60 transition-colors"
          >
            <div className="flex items-center gap-2 text-slate-300 font-medium">
              <Table className="w-3.5 h-3.5 text-blue-400" />
              <span>Query Results ({queryResult.length} rows)</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleExportCsv();
                }}
                className="flex items-center gap-1 px-2 py-0.5 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                title="Download CSV"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="text-[11px]">CSV</span>
              </button>
              {showTable ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
            </div>
          </div>

          {showTable && (
            <div className="border-t border-slate-800 max-h-64 overflow-auto">
              <table className="w-full text-left text-[11px] text-slate-300">
                <thead className="bg-slate-900 text-slate-400 font-semibold sticky top-0">
                  <tr>
                    {columns.map((col) => (
                      <th key={col} className="px-3 py-2 border-b border-slate-800 whitespace-nowrap">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {queryResult.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-900/40">
                      {columns.map((col) => (
                        <td key={col} className="px-3 py-1.5 whitespace-nowrap font-mono text-slate-300">
                          {row[col] === null ? (
                            <span className="text-slate-500 italic">null</span>
                          ) : (
                            String(row[col])
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
