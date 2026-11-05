'use client';

import React from 'react';
import {
  Sparkles,
  Upload,
  Eye,
  RefreshCw,
  FileDown,
  Printer,
  Database,
  Plus,
  X,
  GitMerge,
} from 'lucide-react';
import { DatasetSummary } from '@/types';

interface TopNavProps {
  dataset: DatasetSummary | null;
  isUploading: boolean;
  onUploadClick: () => void;
  onLoadSampleClick: () => void;
  onLoadMultiTableSampleClick?: () => void;
  onSelectTable?: (tableName: string) => void;
  onRemoveTable?: (tableName: string) => void;
  onOpenPreview: () => void;
  onExportPdf?: () => void;
  onExportMarkdown?: () => void;
  hasMessages?: boolean;
  theme: 'light' | 'dark';
}

export const TopNav: React.FC<TopNavProps> = ({
  dataset,
  isUploading,
  onUploadClick,
  onLoadSampleClick,
  onLoadMultiTableSampleClick,
  onSelectTable,
  onRemoveTable,
  onOpenPreview,
  onExportPdf,
  onExportMarkdown,
  hasMessages,
  theme,
}) => {
  const loadedTables = dataset?.loaded_tables || [];

  // Detect shared columns across loaded tables for visual Join badge
  const sharedJoinKeys = React.useMemo(() => {
    if (loadedTables.length < 2) return [];
    const keys = new Set<string>();
    for (let i = 0; i < loadedTables.length; i++) {
      for (let j = i + 1; j < loadedTables.length; j++) {
        const colsA = loadedTables[i].columns.map((c) => c.toLowerCase());
        for (const colB of loadedTables[j].columns) {
          if (colsA.includes(colB.toLowerCase())) {
            keys.add(colB);
          }
        }
      }
    }
    return Array.from(keys);
  }, [loadedTables]);

  return (
    <div className="z-20">
      <header
        className={`h-16 px-8 flex items-center justify-between border-b transition-colors ${
          theme === 'light'
            ? 'bg-white border-slate-200 shadow-sm'
            : 'bg-[#091124] border-slate-800 shadow-sm'
        }`}
      >
        {/* Title & Subtitle */}
        <div>
          <h2
            className={`text-base font-bold tracking-tight ${
              theme === 'light' ? 'text-slate-900' : 'text-white'
            }`}
          >
            Quick Analysis
          </h2>
          <p
            className={`text-xs ${
              theme === 'light' ? 'text-slate-500' : 'text-slate-400'
            }`}
          >
            Ask questions in plain English, join multiple tables & explore with SQL
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {hasMessages && onExportPdf && (
            <button
              onClick={onExportPdf}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                theme === 'light'
                  ? 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-700'
                  : 'bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
              }`}
              title="Print or Save Analysis Report as PDF"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Export PDF</span>
            </button>
          )}

          {hasMessages && onExportMarkdown && (
            <button
              onClick={onExportMarkdown}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                theme === 'light'
                  ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
                  : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
              }`}
              title="Download Markdown (.md) Report"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>Report .MD</span>
            </button>
          )}

          {dataset && (
            <button
              onClick={onOpenPreview}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                theme === 'light'
                  ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
                  : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>View Full Table</span>
            </button>
          )}

          {/* Relational 2-Table Demo Button */}
          {onLoadMultiTableSampleClick && (
            <button
              onClick={onLoadMultiTableSampleClick}
              disabled={isUploading}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                theme === 'light'
                  ? 'border-indigo-500/40 text-indigo-600 bg-indigo-50/60 hover:bg-indigo-100/70'
                  : 'border-indigo-500/40 text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20'
              }`}
              title="Load 2 relational tables (sales_data + region_targets) to test SQL Joins"
            >
              {isUploading ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <GitMerge className="w-3.5 h-3.5 text-indigo-500" />
              )}
              <span>2-Table Join Demo</span>
            </button>
          )}

          {/* Load Sample Button */}
          <button
            onClick={onLoadSampleClick}
            disabled={isUploading}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
              theme === 'light'
                ? 'border-blue-500/40 text-blue-600 bg-blue-50/60 hover:bg-blue-100/70'
                : 'border-blue-500/40 text-blue-400 bg-blue-500/10 hover:bg-blue-500/20'
            }`}
          >
            {isUploading ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-blue-500" />
            )}
            <span>Load Sample</span>
          </button>

          {/* Upload File Button */}
          <button
            onClick={onUploadClick}
            disabled={isUploading}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{loadedTables.length > 0 ? 'Add Table(s)' : 'Upload File(s)'}</span>
          </button>
        </div>
      </header>

      {/* Multi-Table Workspace Bar (visible whenever 1 or more tables are loaded) */}
      {loadedTables.length > 0 && (
        <div
          className={`px-8 py-2 border-b flex items-center justify-between gap-4 flex-wrap text-xs transition-colors ${
            theme === 'light'
              ? 'bg-slate-50/90 border-slate-200/80 text-slate-700'
              : 'bg-[#070e20] border-slate-800/80 text-slate-300'
          }`}
        >
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1 mr-1">
              <Database className="w-3.5 h-3.5 text-blue-500" />
              <span>DuckDB Tables ({loadedTables.length}):</span>
            </span>

            {loadedTables.map((tbl) => {
              const isActive =
                dataset?.table_name === tbl.table_name ||
                dataset?.dataset_id === tbl.table_name;
              return (
                <div
                  key={tbl.table_name}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-mono transition ${
                    isActive
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm font-semibold'
                      : theme === 'light'
                      ? 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700'
                      : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-300'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onSelectTable && onSelectTable(tbl.table_name)}
                    className="flex items-center gap-1.5 text-left"
                    title={`Click to set ${tbl.table_name} (${tbl.filename}) as active default table`}
                  >
                    <span>{tbl.table_name}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded ${
                        isActive
                          ? 'bg-blue-700 text-blue-100'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {tbl.row_count}r
                    </span>
                  </button>
                  {onRemoveTable && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveTable(tbl.table_name);
                      }}
                      className={`p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 ${
                        isActive ? 'text-blue-100 hover:text-white' : 'text-slate-400 hover:text-rose-500'
                      }`}
                      title={`Drop table ${tbl.table_name}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}

            <button
              type="button"
              onClick={onUploadClick}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-dashed text-[11px] font-medium transition ${
                theme === 'light'
                  ? 'border-slate-300 hover:border-blue-500 text-slate-500 hover:text-blue-600 bg-white/50'
                  : 'border-slate-700 hover:border-blue-400 text-slate-400 hover:text-blue-400 bg-slate-900/40'
              }`}
              title="Upload another CSV, Excel, or Parquet file to join with existing tables"
            >
              <Plus className="w-3 h-3" />
              <span>Add Table to Join</span>
            </button>
          </div>

          {/* Detected Join Key Pill */}
          {sharedJoinKeys.length > 0 && (
            <div className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-medium">
              <GitMerge className="w-3.5 h-3.5" />
              <span>
                Auto-Join Ready on:{' '}
                <strong className="font-mono">{sharedJoinKeys.join(', ')}</strong>
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
