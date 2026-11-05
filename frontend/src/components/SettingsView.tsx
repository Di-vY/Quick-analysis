'use client';

import React from 'react';
import { Settings as SettingsIcon, Sun, Moon, Cpu, Server, Database, Trash2, CheckCircle2 } from 'lucide-react';

interface SettingsViewProps {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  backendOnline: boolean | null;
  onClearSession: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  theme,
  onToggleTheme,
  backendOnline,
  onClearSession,
}) => {
  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden p-6 max-w-3xl space-y-6">
      <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
        <h3 className={`text-base font-bold flex items-center gap-2 ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>
          <SettingsIcon className="w-5 h-5 text-blue-500" />
          <span>System Settings & Configuration</span>
        </h3>
        <p className="text-xs text-slate-500">
          Manage interface appearance, AI model configurations, and backend status.
        </p>
      </div>

      <div className="space-y-4">
        {/* Appearance Card */}
        <div
          className={`p-5 rounded-2xl border ${
            theme === 'light' ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#0b142c] border-slate-800'
          }`}
        >
          <h4 className={`text-xs font-bold uppercase tracking-wider ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
            Appearance
          </h4>
          <div className="flex items-center justify-between mt-3">
            <div>
              <p className={`text-xs font-semibold ${theme === 'light' ? 'text-slate-800' : 'text-slate-100'}`}>
                Interface Theme
              </p>
              <p className="text-[11px] text-slate-400">
                Currently using {theme === 'light' ? 'Light Mode with Navy Sidebar' : 'Dark Mode'}
              </p>
            </div>
            <button
              onClick={onToggleTheme}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-xs font-medium transition ${
                theme === 'light'
                  ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
                  : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
              }`}
            >
              {theme === 'light' ? (
                <>
                  <Moon className="w-3.5 h-3.5" />
                  <span>Switch to Dark</span>
                </>
              ) : (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span>Switch to Light</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* AI Model & Engine Info */}
        <div
          className={`p-5 rounded-2xl border ${
            theme === 'light' ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#0b142c] border-slate-800'
          }`}
        >
          <h4 className={`text-xs font-bold uppercase tracking-wider ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
            Engine & AI Model
          </h4>

          <div className="mt-3 space-y-3 divide-y divide-slate-100 dark:divide-slate-800/80">
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2.5">
                <Cpu className="w-4 h-4 text-blue-500" />
                <div>
                  <p className={`text-xs font-semibold ${theme === 'light' ? 'text-slate-800' : 'text-slate-100'}`}>
                    LLM Synthesis Engine
                  </p>
                  <p className="text-[11px] text-slate-400">Google Gemini 3.5 Flash (with multi-model fallback)</p>
                </div>
              </div>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-500 font-medium">
                Active
              </span>
            </div>

            <div className="flex items-center justify-between pt-3">
              <div className="flex items-center gap-2.5">
                <Database className="w-4 h-4 text-emerald-500" />
                <div>
                  <p className={`text-xs font-semibold ${theme === 'light' ? 'text-slate-800' : 'text-slate-100'}`}>
                    SQL Analytical Engine
                  </p>
                  <p className="text-[11px] text-slate-400">DuckDB (In-memory columnar execution)</p>
                </div>
              </div>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 font-medium">
                0-Latency
              </span>
            </div>

            <div className="flex items-center justify-between pt-3">
              <div className="flex items-center gap-2.5">
                <Server className="w-4 h-4 text-indigo-500" />
                <div>
                  <p className={`text-xs font-semibold ${theme === 'light' ? 'text-slate-800' : 'text-slate-100'}`}>
                    FastAPI Backend
                  </p>
                  <p className="text-[11px] text-slate-400">http://127.0.0.1:8000</p>
                </div>
              </div>
              <span
                className={`text-[11px] font-medium px-2 py-0.5 rounded ${
                  backendOnline
                    ? 'bg-emerald-500/10 text-emerald-500'
                    : 'bg-rose-500/10 text-rose-500'
                }`}
              >
                {backendOnline ? 'Connected' : 'Offline'}
              </span>
            </div>
          </div>
        </div>

        {/* Danger / Reset Zone */}
        <div
          className={`p-5 rounded-2xl border ${
            theme === 'light' ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#0b142c] border-slate-800'
          }`}
        >
          <h4 className={`text-xs font-bold uppercase tracking-wider text-rose-500`}>
            Session Management
          </h4>
          <div className="flex items-center justify-between mt-3">
            <div>
              <p className={`text-xs font-semibold ${theme === 'light' ? 'text-slate-800' : 'text-slate-100'}`}>
                Clear Chat History
              </p>
              <p className="text-[11px] text-slate-400">
                Wipe active chat thread and start fresh
              </p>
            </div>
            <button
              onClick={onClearSession}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/30 text-xs font-medium transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear History</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
