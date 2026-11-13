'use client';

import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Sun, Moon, Cpu, Server, Database, Trash2, KeyRound, Check } from 'lucide-react';
import { ACCESS_KEY_STORAGE_KEY } from '@/lib/api';

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
  const [accessKey, setAccessKey] = useState('');
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(ACCESS_KEY_STORAGE_KEY) || '';
    setAccessKey(stored);
  }, []);

  const handleSaveKey = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = accessKey.trim();
    if (trimmed) {
      localStorage.setItem(ACCESS_KEY_STORAGE_KEY, trimmed);
    } else {
      localStorage.removeItem(ACCESS_KEY_STORAGE_KEY);
    }
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2000);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto p-6 max-w-3xl space-y-6">
      <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
        <h3 className={`text-base font-bold flex items-center gap-2 ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>
          <SettingsIcon className="w-5 h-5 text-blue-500" />
          <span>System Settings & Configuration</span>
        </h3>
        <p className="text-xs text-slate-500">
          Manage interface appearance, API access authentication, AI model configurations, and backend status.
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

        {/* API Access Key Card */}
        <div
          className={`p-5 rounded-2xl border ${
            theme === 'light' ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#0b142c] border-slate-800'
          }`}
        >
          <h4 className={`text-xs font-bold uppercase tracking-wider ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
            API Access Authentication
          </h4>
          <p className="text-[11px] text-slate-400 mt-1">
            When <code className="font-mono text-blue-500">APP_ACCESS_KEY</code> is configured on the FastAPI server, enter the key here so requests include the <code className="font-mono text-blue-500">X-API-Key</code> header.
          </p>
          <form onSubmit={handleSaveKey} className="mt-3 flex items-center gap-2">
            <div className="relative flex-1">
              <KeyRound className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="password"
                value={accessKey}
                onChange={(e) => setAccessKey(e.target.value)}
                placeholder="Enter backend access key (optional locally)..."
                className={`w-full pl-9 pr-3 py-1.5 rounded-xl border text-xs font-mono focus:outline-none focus:border-blue-500 ${
                  theme === 'light'
                    ? 'bg-slate-50 border-slate-300 text-slate-900'
                    : 'bg-slate-900 border-slate-700 text-white'
                }`}
              />
            </div>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition"
            >
              {savedNotice ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Saved</span>
                </>
              ) : (
                <span>Save Key</span>
              )}
            </button>
          </form>
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
                  <p className="text-[11px] text-slate-400">DuckDB (Sandboxed in-memory, 15s query timeout)</p>
                </div>
              </div>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 font-medium">
                Hardened
              </span>
            </div>

            <div className="flex items-center justify-between pt-3">
              <div className="flex items-center gap-2.5">
                <Server className="w-4 h-4 text-indigo-500" />
                <div>
                  <p className={`text-xs font-semibold ${theme === 'light' ? 'text-slate-800' : 'text-slate-100'}`}>
                    FastAPI Backend
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'}
                  </p>
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
