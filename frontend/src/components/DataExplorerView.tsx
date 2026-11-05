'use client';

import React, { useState } from 'react';
import { Database, Search, Download, Layers, AlertCircle, FileSpreadsheet } from 'lucide-react';
import { DatasetSummary } from '@/types';

interface DataExplorerViewProps {
  dataset: DatasetSummary | null;
  theme: 'light' | 'dark';
}

export const DataExplorerView: React.FC<DataExplorerViewProps> = ({ dataset, theme }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'columns' | 'preview'>('preview');

  if (!dataset) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center mb-4">
          <Database className="w-8 h-8" />
        </div>
        <h3 className={`text-base font-bold ${theme === 'light' ? 'text-slate-800' : 'text-slate-200'}`}>
          No Dataset Loaded
        </h3>
        <p className="text-xs text-slate-500 mt-1 max-w-sm">
          Upload a CSV or Excel file from the top bar to inspect its table schema, columns, and data types.
        </p>
      </div>
    );
  }

  const filteredColumns = dataset.columns.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleExportCsv = () => {
    if (!dataset.preview_rows || dataset.preview_rows.length === 0) return;
    const headers = dataset.columns.map((c) => c.name);
    const rows = dataset.preview_rows.map((row) =>
      headers
        .map((h) => {
          const val = row[h] === null || row[h] === undefined ? '' : String(row[h]);
          return `"${val.replace(/"/g, '""')}"`;
        })
        .join(',')
    );
    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${dataset.filename.replace(/\.[^/.]+$/, '')}_preview.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden p-6 space-y-5">
      {/* Dataset Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div
          className={`p-4 rounded-xl border ${
            theme === 'light' ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#0b142c] border-slate-800'
          }`}
        >
          <p className="text-xs text-slate-400 font-medium">Dataset File</p>
          <div className="flex items-center gap-2 mt-1">
            <FileSpreadsheet className="w-4 h-4 text-blue-500 flex-shrink-0" />
            <h4 className={`text-sm font-bold truncate ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>
              {dataset.filename}
            </h4>
          </div>
        </div>

        <div
          className={`p-4 rounded-xl border ${
            theme === 'light' ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#0b142c] border-slate-800'
          }`}
        >
          <p className="text-xs text-slate-400 font-medium">Total Rows</p>
          <h4 className={`text-lg font-bold mt-1 ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>
            {dataset.row_count.toLocaleString()}
          </h4>
        </div>

        <div
          className={`p-4 rounded-xl border ${
            theme === 'light' ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#0b142c] border-slate-800'
          }`}
        >
          <p className="text-xs text-slate-400 font-medium">Total Columns</p>
          <h4 className={`text-lg font-bold mt-1 ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>
            {dataset.column_count}
          </h4>
        </div>
      </div>

      {/* Sub-Tabs: Table View vs Columns Schema */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('preview')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === 'preview'
                ? 'bg-blue-600 text-white'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            Data Preview
          </button>
          <button
            onClick={() => setActiveTab('columns')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === 'columns'
                ? 'bg-blue-600 text-white'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            Column Schema ({dataset.column_count})
          </button>
        </div>

        <button
          onClick={handleExportCsv}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 transition"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export CSV</span>
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto rounded-xl border border-slate-200 dark:border-slate-800">
        {activeTab === 'preview' ? (
          <div className="min-w-full overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead
                className={`sticky top-0 z-10 ${
                  theme === 'light' ? 'bg-slate-100 text-slate-700' : 'bg-slate-900 text-slate-300'
                }`}
              >
                <tr>
                  <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 w-12 text-slate-400">#</th>
                  {dataset.columns.map((col) => (
                    <th key={col.name} className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 whitespace-nowrap">
                      <div className="font-semibold">{col.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono font-normal">{col.data_type}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 font-mono">
                {dataset.preview_rows.map((row, idx) => (
                  <tr
                    key={idx}
                    className={`transition-colors ${
                      theme === 'light' ? 'hover:bg-slate-50 text-slate-700' : 'hover:bg-slate-800/40 text-slate-300'
                    }`}
                  >
                    <td className="px-4 py-2 text-slate-400">{idx + 1}</td>
                    {dataset.columns.map((col) => (
                      <td key={col.name} className="px-4 py-2 whitespace-nowrap">
                        {row[col.name] === null ? (
                          <span className="text-slate-400 italic">null</span>
                        ) : (
                          String(row[col.name])
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            <div className="relative max-w-sm">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search columns..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full pl-9 pr-3 py-1.5 rounded-lg text-xs border focus:outline-none focus:border-blue-500 ${
                  theme === 'light' ? 'bg-white border-slate-300 text-slate-900' : 'bg-slate-900 border-slate-700 text-white'
                }`}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              {filteredColumns.map((col) => (
                <div
                  key={col.name}
                  className={`p-3 rounded-xl border flex flex-col justify-between ${
                    theme === 'light' ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-900 border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold text-blue-500">{col.name}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                      {col.data_type}
                    </span>
                  </div>
                  <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between">
                    <span>Nulls: {col.null_count}</span>
                    {col.sample_values && col.sample_values.length > 0 && (
                      <span className="truncate max-w-[200px]" title={col.sample_values.join(', ')}>
                        Samples: {col.sample_values.slice(0, 2).join(', ')}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
