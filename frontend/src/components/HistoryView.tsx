'use client';

import React from 'react';
import { Clock, Code, ArrowRight, MessageSquare, Terminal, Printer, FileDown } from 'lucide-react';
import { Message } from '@/types';

interface HistoryViewProps {
  messages: Message[];
  onSelectPrompt: (prompt: string) => void;
  onOpenSql: (sql: string) => void;
  onExportPdf?: () => void;
  onExportMarkdown?: () => void;
  theme: 'light' | 'dark';
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  messages,
  onSelectPrompt,
  onOpenSql,
  onExportPdf,
  onExportMarkdown,
  theme,
}) => {
  // Filter for assistant responses that have SQL or answers
  const queryHistory = messages.filter((m) => m.role === 'assistant' && !m.id.startsWith('welcome') && (m.sql_query || m.content));

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div>
          <h3 className={`text-base font-bold flex items-center gap-2 ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>
            <Clock className="w-5 h-5 text-blue-500" />
            <span>Analysis & Query History</span>
          </h3>
          <p className="text-xs text-slate-500">
            Review previous analytical queries, generated DuckDB SQL, and answers from this session.
          </p>
        </div>

        {queryHistory.length > 0 && (
          <div className="flex items-center gap-2">
            {onExportPdf && (
              <button
                onClick={onExportPdf}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition shadow-xs"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print / Save PDF Report</span>
              </button>
            )}
            {onExportMarkdown && (
              <button
                onClick={onExportMarkdown}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition ${
                  theme === 'light'
                    ? 'bg-white hover:bg-slate-50 border-slate-300 text-slate-700'
                    : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                }`}
              >
                <FileDown className="w-3.5 h-3.5" />
                <span>Download .MD</span>
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto space-y-3 pr-1">
        {queryHistory.length > 0 ? (
          queryHistory.map((item, index) => (
            <div
              key={item.id}
              className={`p-4 rounded-xl border transition-all ${
                theme === 'light'
                  ? 'bg-white border-slate-200 hover:border-blue-400 shadow-sm'
                  : 'bg-[#0b142c] border-slate-800 hover:border-blue-500/50'
              }`}
            >
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-semibold text-blue-500 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Query #{index + 1}</span>
                </span>
                <span className="text-slate-400 font-mono text-[11px]">{item.timestamp}</span>
              </div>

              {/* Answer Snippet */}
              <p className={`text-xs line-clamp-2 ${theme === 'light' ? 'text-slate-700' : 'text-slate-300'}`}>
                {item.content.replace(/[#*`_]/g, '')}
              </p>

              {/* SQL snippet if available */}
              {item.sql_query && (
                <div className="mt-3 p-2.5 rounded-lg bg-slate-900 border border-slate-800 font-mono text-[11px] text-emerald-400 flex items-center justify-between overflow-hidden">
                  <span className="truncate mr-3">{item.sql_query}</span>
                  <button
                    onClick={() => onOpenSql(item.sql_query!)}
                    className="flex items-center gap-1 text-[11px] font-semibold text-blue-400 hover:text-blue-300 flex-shrink-0"
                  >
                    <Terminal className="w-3 h-3" />
                    <span>Open in SQL</span>
                  </button>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400 text-xs">
            No queries asked yet. Ask a question in the Overview tab to build your session history.
          </div>
        )}
      </div>
    </div>
  );
};
