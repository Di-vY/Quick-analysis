'use client';

import React from 'react';
import {
  LayoutDashboard,
  Database,
  Code2,
  Clock,
  Settings,
  BarChart3,
  Sun,
  Moon,
  FileSpreadsheet,
} from 'lucide-react';
import { DatasetSummary } from '@/types';

export type TabType = 'overview' | 'data' | 'sql' | 'history' | 'settings';

interface NavigationSidebarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  dataset: DatasetSummary | null;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export const NavigationSidebar: React.FC<NavigationSidebarProps> = ({
  activeTab,
  onTabChange,
  dataset,
  theme,
  onToggleTheme,
}) => {
  const navItems = [
    { id: 'overview' as TabType, label: 'Overview', icon: LayoutDashboard },
    { id: 'data' as TabType, label: 'Data', icon: Database },
    { id: 'sql' as TabType, label: 'SQL Workspace', icon: Code2 },
    { id: 'history' as TabType, label: 'History', icon: Clock },
    { id: 'settings' as TabType, label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="w-64 flex-shrink-0 h-screen bg-[#07112c] text-slate-300 flex flex-col justify-between select-none border-r border-[#15234d] z-30 transition-colors">
      {/* Brand Header */}
      <div>
        <div className="h-16 flex items-center gap-3 px-5 border-b border-[#15234d]">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/30">
            <BarChart3 className="w-4 h-4" />
          </div>
          <span className="font-semibold text-sm tracking-tight text-white">
            Quick Analysis
          </span>
        </div>

        {/* Navigation Items */}
        <nav className="p-3 space-y-1.5 mt-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-blue-600/20 text-white font-semibold shadow-sm shadow-blue-500/10 border border-blue-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#0f1d47]/60'
                }`}
              >
                <Icon
                  className={`w-4 h-4 ${
                    isActive ? 'text-blue-400' : 'text-slate-400'
                  }`}
                />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Area: Dataset indicator + Theme Toggle + User Avatar */}
      <div className="p-4 border-t border-[#15234d] space-y-3">
        {/* Dataset Mini Badge */}
        {dataset && (
          <div className="p-2.5 rounded-xl bg-[#0f1d47]/80 border border-[#1e306e] text-xs">
            <div className="flex items-center gap-2 text-slate-200">
              <FileSpreadsheet className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
              <span className="truncate font-medium text-[11px]" title={dataset.filename}>
                {dataset.filename}
              </span>
            </div>
            <div className="text-[10px] text-slate-400 mt-1 flex justify-between font-mono">
              <span>{dataset.row_count.toLocaleString()} rows</span>
              <span>{dataset.column_count} cols</span>
            </div>
          </div>
        )}

        {/* Theme switcher & User profile footer */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#182859] border border-[#233878] flex items-center justify-center text-xs font-semibold text-slate-200">
              DA
            </div>
            <div className="text-left">
              <p className="text-xs font-medium text-slate-200">Analyst</p>
              <p className="text-[10px] text-emerald-400">DuckDB Ready</p>
            </div>
          </div>

          <button
            onClick={onToggleTheme}
            className="p-1.5 rounded-lg bg-[#0f1d47] hover:bg-[#182859] text-slate-400 hover:text-slate-100 transition border border-[#1e306e]"
            title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
          >
            {theme === 'light' ? (
              <Moon className="w-4 h-4" />
            ) : (
              <Sun className="w-4 h-4 text-amber-400" />
            )}
          </button>
        </div>
      </div>
    </aside>
  );
};
