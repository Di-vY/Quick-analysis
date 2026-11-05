'use client';

import React, { useRef, useState } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  Database,
  Layers,
  Eye,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { DatasetSummary } from '@/types';
import { uploadDataset } from '@/lib/api';

interface SidebarProps {
  dataset: DatasetSummary | null;
  onDatasetLoaded: (summary: DatasetSummary) => void;
  onOpenPreview: () => void;
  onSampleLoaded?: () => void;
  isLoading: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  dataset,
  onDatasetLoaded,
  onOpenPreview,
  isLoading,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  const processFile = async (file: File) => {
    setIsUploading(true);
    setUploadError(null);
    try {
      const summary = await uploadDataset(file);
      onDatasetLoaded(summary);
    } catch (err: any) {
      setUploadError(err.message || 'Failed to upload dataset');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const loadSampleDataset = async () => {
    // Generate a file from sample sales data and upload
    const sampleCsv = `Order_ID,Order_Date,Customer_Name,Region,Category,Sub_Category,Sales,Quantity,Discount,Profit
CA-2024-1001,2024-01-15,Alice Smith,West,Technology,Phones,850.50,2,0.1,120.50
CA-2024-1002,2024-01-18,Bob Johnson,East,Furniture,Chairs,420.00,3,0.2,35.00
CA-2024-1003,2024-02-05,Charlie Brown,Central,Office Supplies,Binders,25.40,5,0.0,8.20
CA-2024-1004,2024-02-12,David Lee,West,Technology,Accessories,150.00,1,0.0,45.00
CA-2024-1005,2024-02-28,Emma Wilson,South,Furniture,Tables,780.00,2,0.3,-60.00
CA-2024-1006,2024-03-04,Frank Miller,East,Technology,Machines,1200.00,1,0.1,240.00
CA-2024-1007,2024-03-10,Grace Taylor,West,Office Supplies,Paper,45.60,4,0.0,18.50
CA-2024-1008,2024-03-22,Henry Anderson,South,Technology,Phones,950.00,2,0.0,190.00
CA-2024-1009,2024-04-02,Isabella Thomas,Central,Furniture,Bookcases,320.00,1,0.15,12.00
CA-2024-1010,2024-04-18,Jack Jackson,East,Technology,Accessories,85.00,2,0.0,22.00
CA-2024-1011,2024-05-01,Karen White,West,Furniture,Chairs,610.00,4,0.2,50.00
CA-2024-1012,2024-05-15,Liam Harris,Central,Office Supplies,Storage,180.00,3,0.1,28.00
CA-2024-1013,2024-06-03,Mia Martin,South,Technology,Phones,1100.00,2,0.1,165.00
CA-2024-1014,2024-06-20,Noah Clark,East,Furniture,Furnishings,95.00,5,0.0,30.00
CA-2024-1015,2024-07-08,Olivia Rodriguez,West,Technology,Copiers,1850.00,1,0.2,370.00`;

    const blob = new Blob([sampleCsv], { type: 'text/csv' });
    const sampleFile = new File([blob], 'sales_data.csv', { type: 'text/csv' });
    await processFile(sampleFile);
  };

  const filteredColumns = dataset?.columns.filter((c) =>
    c.name.toLowerCase().includes(filterQuery.toLowerCase())
  );

  return (
    <aside className="w-80 h-screen flex flex-col bg-slate-950 border-r border-slate-800 text-slate-200 select-none">
      {/* Top Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Database className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="font-semibold text-sm tracking-tight text-white">Data Analyst AI</h1>
            <p className="text-[11px] text-slate-400">DuckDB + Gemini Flash</p>
          </div>
        </div>
      </div>

      {/* Dataset Overview or Upload Area */}
      <div className="p-4 space-y-3 flex-shrink-0">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".csv,.xlsx,.xls,.parquet"
          className="hidden"
        />

        {/* Upload Drop Zone */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="border border-dashed border-slate-700 hover:border-blue-500/70 bg-slate-900/60 hover:bg-slate-900/90 rounded-xl p-4 text-center cursor-pointer transition-all duration-200 group"
        >
          <UploadCloud className="w-7 h-7 mx-auto mb-1.5 text-slate-400 group-hover:text-blue-400 transition-colors" />
          <p className="text-xs font-medium text-slate-200">
            {isUploading ? 'Uploading & profiling...' : 'Click or drop file to upload'}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">Supports CSV, Excel (.xlsx), Parquet</p>
        </div>

        {/* Load Sample Button */}
        {!dataset && (
          <button
            type="button"
            disabled={isUploading}
            onClick={loadSampleDataset}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 text-xs font-medium transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            <span>Load Sample Sales Data</span>
          </button>
        )}

        {uploadError && (
          <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-start gap-2 text-rose-300 text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed">{uploadError}</p>
          </div>
        )}

        {/* Active Dataset Card */}
        {dataset && (
          <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 truncate">
                <FileSpreadsheet className="w-4 h-4 text-blue-400 flex-shrink-0" />
                <span className="text-xs font-medium text-slate-100 truncate" title={dataset.filename}>
                  {dataset.filename}
                </span>
              </div>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
            </div>

            <div className="grid grid-cols-2 gap-2 text-center pt-1 border-t border-slate-800/80">
              <div className="bg-slate-950/60 p-1.5 rounded-md">
                <p className="text-[10px] text-slate-400">Total Rows</p>
                <p className="text-xs font-semibold text-slate-200">{dataset.row_count.toLocaleString()}</p>
              </div>
              <div className="bg-slate-950/60 p-1.5 rounded-md">
                <p className="text-[10px] text-slate-400">Columns</p>
                <p className="text-xs font-semibold text-slate-200">{dataset.column_count}</p>
              </div>
            </div>

            <button
              onClick={onOpenPreview}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700/80 text-slate-300 text-xs font-medium transition-colors"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Preview First 5 Rows</span>
            </button>
          </div>
        )}
      </div>

      {/* Schema / Columns List */}
      <div className="flex-1 flex flex-col min-h-0 px-4 pb-4">
        <div className="flex items-center justify-between py-2 border-t border-slate-800">
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
            <Layers className="w-3.5 h-3.5 text-blue-400" />
            <span>Table Columns ({dataset?.columns.length || 0})</span>
          </div>
        </div>

        {dataset && dataset.columns.length > 6 && (
          <div className="mb-2">
            <input
              type="text"
              placeholder="Filter columns..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              className="w-full px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-md text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>
        )}

        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 text-xs">
          {dataset ? (
            filteredColumns && filteredColumns.length > 0 ? (
              filteredColumns.map((col) => (
                <div
                  key={col.name}
                  className="p-2 rounded-lg bg-slate-900/50 hover:bg-slate-900 border border-slate-800/80 flex items-center justify-between group transition-colors"
                >
                  <div className="truncate mr-2">
                    <p className="font-mono text-slate-200 truncate group-hover:text-blue-300" title={col.name}>
                      {col.name}
                    </p>
                    {col.sample_values && col.sample_values.length > 0 && (
                      <p className="text-[10px] text-slate-500 truncate" title={col.sample_values.join(', ')}>
                        e.g. {col.sample_values.slice(0, 2).join(', ')}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-slate-800 text-slate-400">
                      {col.data_type.toUpperCase()}
                    </span>
                    {col.null_count > 0 && (
                      <span className="text-[9px] text-amber-400">{col.null_count} nulls</span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-[11px] text-slate-500 text-center py-4">No matching columns</p>
            )
          ) : (
            <div className="text-center py-8 text-slate-500 text-xs">
              Upload a dataset or load the sample data to inspect its schema.
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
