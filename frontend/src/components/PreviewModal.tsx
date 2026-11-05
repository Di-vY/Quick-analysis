'use client';

import React from 'react';
import { X, Table } from 'lucide-react';
import { DatasetSummary } from '@/types';

interface PreviewModalProps {
  dataset: DatasetSummary | null;
  isOpen: boolean;
  onClose: () => void;
}

export const PreviewModal: React.FC<PreviewModalProps> = ({ dataset, isOpen, onClose }) => {
  if (!isOpen || !dataset) return null;

  const columns = dataset.columns.map((c) => c.name);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <Table className="w-5 h-5 text-blue-400" />
            <div>
              <h3 className="font-semibold text-slate-100 text-sm">
                Dataset Preview: {dataset.filename}
              </h3>
              <p className="text-xs text-slate-400">
                Displaying first {dataset.preview_rows.length} rows across {dataset.column_count} columns
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Table Body */}
        <div className="flex-1 overflow-auto p-4">
          <div className="border border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 font-semibold sticky top-0">
                <tr>
                  <th className="px-3 py-2.5 border-b border-slate-800 w-12 text-slate-600">#</th>
                  {dataset.columns.map((col) => (
                    <th key={col.name} className="px-3 py-2.5 border-b border-slate-800 whitespace-nowrap">
                      <div className="font-mono text-slate-200">{col.name}</div>
                      <div className="text-[10px] text-slate-500 font-normal">{col.data_type}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {dataset.preview_rows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-3 py-2 text-slate-600 font-mono text-[11px]">{idx + 1}</td>
                    {columns.map((col) => (
                      <td key={col} className="px-3 py-2 whitespace-nowrap font-mono text-slate-300">
                        {row[col] === null ? (
                          <span className="text-slate-600 italic">null</span>
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
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/40 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
};
