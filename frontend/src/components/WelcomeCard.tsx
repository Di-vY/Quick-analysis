'use client';

import React from 'react';
import { Sparkles, Upload, FileSpreadsheet, MessageSquare, Code, BarChart2 } from 'lucide-react';

interface WelcomeCardProps {
  onLoadSample: () => void;
  onUploadClick: () => void;
  isUploading: boolean;
  theme: 'light' | 'dark';
}

export const WelcomeCard: React.FC<WelcomeCardProps> = ({
  onLoadSample,
  onUploadClick,
  isUploading,
  theme,
}) => {
  return (
    <div
      className={`max-w-2xl w-full mx-auto my-auto rounded-2xl p-8 border shadow-xl text-center space-y-6 transition-all duration-300 ${
        theme === 'light'
          ? 'bg-white border-slate-200/80 shadow-slate-200/60'
          : 'bg-[#0b142c] border-slate-800 shadow-black/40'
      }`}
    >
      {/* Icon Badge */}
      <div
        className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center shadow-sm ${
          theme === 'light'
            ? 'bg-blue-50 text-blue-600 border border-blue-100'
            : 'bg-blue-600/15 text-blue-400 border border-blue-500/20'
        }`}
      >
        <FileSpreadsheet className="w-8 h-8" />
      </div>

      {/* Headline & Description */}
      <div className="space-y-2 max-w-lg mx-auto">
        <h3
          className={`text-xl font-bold tracking-tight ${
            theme === 'light' ? 'text-slate-900' : 'text-white'
          }`}
        >
          Upload Your Dataset to Begin
        </h3>
        <p
          className={`text-xs leading-relaxed ${
            theme === 'light' ? 'text-slate-500' : 'text-slate-400'
          }`}
        >
          Upload any CSV or Excel file to ask questions, view insights, and
          generate charts. Or try the bundled sample data to see how it works instantly.
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-1">
        <button
          onClick={onLoadSample}
          disabled={isUploading}
          className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold shadow-md shadow-blue-600/25 transition-all flex items-center justify-center gap-2"
        >
          <Sparkles className="w-4 h-4" />
          <span>Load Sample Sales Data</span>
        </button>

        <button
          onClick={onUploadClick}
          disabled={isUploading}
          className={`w-full sm:w-auto px-6 py-2.5 rounded-xl border text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
            theme === 'light'
              ? 'bg-white hover:bg-slate-50 border-slate-300 text-slate-700 shadow-sm'
              : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700 text-slate-200'
          }`}
        >
          <Upload className="w-4 h-4" />
          <span>Choose CSV / Excel File</span>
        </button>
      </div>

      {/* 3 Feature Highlights (matching bottom row of screenshot) */}
      <div
        className={`grid grid-cols-1 md:grid-cols-3 gap-4 pt-6 border-t ${
          theme === 'light' ? 'border-slate-100 text-slate-600' : 'border-slate-800/80 text-slate-300'
        }`}
      >
        <div className="flex items-center gap-3 text-left">
          <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500 flex-shrink-0">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-semibold">Ask Questions</h4>
            <p className="text-[11px] text-slate-400">Get insights in plain English</p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-left">
          <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-500 flex-shrink-0">
            <Code className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-semibold">Use SQL</h4>
            <p className="text-[11px] text-slate-400">Explore and analyze with SQL</p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-left">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500 flex-shrink-0">
            <BarChart2 className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-semibold">View Results</h4>
            <p className="text-[11px] text-slate-400">See tables, summaries & charts</p>
          </div>
        </div>
      </div>
    </div>
  );
};
