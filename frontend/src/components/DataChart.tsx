'use client';

import React, { useState, useMemo, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { BarChart2, TrendingUp, PieChart, Activity } from 'lucide-react';
import { ChartSpec } from '@/types';

// Dynamically import Plotly to prevent SSR hydration errors
const Plot = dynamic(() => import('react-plotly.js'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-72 flex items-center justify-center bg-slate-100 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-400 text-xs animate-pulse">
      Loading interactive visualization...
    </div>
  ),
});

interface DataChartProps {
  chart: ChartSpec;
  theme?: 'light' | 'dark';
}

type SupportedChartType = 'bar' | 'line' | 'pie' | 'scatter';

export const DataChart: React.FC<DataChartProps> = ({ chart, theme = 'light' }) => {
  const { chart_type, title, x_column, y_column, data } = chart;

  const availableColumns = useMemo(() => {
    if (!data || data.length === 0) return [];
    return Object.keys(data[0]);
  }, [data]);

  const initialType: SupportedChartType =
    chart_type === 'line' || chart_type === 'pie' || chart_type === 'scatter'
      ? chart_type
      : 'bar';

  const [activeChartType, setActiveChartType] = useState<SupportedChartType>(initialType);
  const [selectedX, setSelectedX] = useState<string>(
    x_column || availableColumns[0] || ''
  );
  const [selectedY, setSelectedY] = useState<string>(
    y_column || availableColumns[1] || availableColumns[0] || ''
  );

  useEffect(() => {
    setActiveChartType(
      chart_type === 'line' || chart_type === 'pie' || chart_type === 'scatter'
        ? chart_type
        : 'bar'
    );
    if (x_column) setSelectedX(x_column);
    if (y_column) setSelectedY(y_column);
  }, [chart_type, x_column, y_column]);

  const plotData = useMemo(() => {
    if (!data || data.length === 0 || !selectedX) return null;

    const xVals = data.map((d) => d[selectedX]);
    const yVals = selectedY ? data.map((d) => d[selectedY]) : [];

    switch (activeChartType) {
      case 'pie':
        return [
          {
            type: 'pie' as const,
            labels: xVals,
            values: yVals,
            hoverinfo: 'label+percent+value',
            textinfo: 'label+percent',
            hole: 0.38,
            marker: {
              colors: [
                '#2563eb',
                '#10b981',
                '#f59e0b',
                '#8b5cf6',
                '#ec4899',
                '#06b6d4',
                '#14b8a6',
                '#f97316',
              ],
            },
          },
        ];

      case 'line':
        return [
          {
            type: 'scatter' as const,
            mode: 'lines+markers' as const,
            x: xVals,
            y: yVals,
            line: { color: '#2563eb', width: 3 },
            marker: { color: '#1d4ed8', size: 7 },
            hoverinfo: 'x+y' as const,
          },
        ];

      case 'scatter':
        return [
          {
            type: 'scatter' as const,
            mode: 'markers' as const,
            x: xVals,
            y: yVals,
            marker: {
              color: '#8b5cf6',
              size: 11,
              opacity: 0.85,
              line: { color: '#6d28d9', width: 1 },
            },
          },
        ];

      case 'bar':
      default:
        return [
          {
            type: 'bar' as const,
            x: xVals,
            y: yVals,
            marker: {
              color: '#2563eb',
              opacity: 0.9,
              line: { color: '#1d4ed8', width: 1 },
            },
          },
        ];
    }
  }, [activeChartType, data, selectedX, selectedY]);

  if (!plotData) return null;

  const isLight = theme === 'light';

  const chartTypes: { id: SupportedChartType; label: string; icon: any }[] = [
    { id: 'bar', label: 'Bar', icon: BarChart2 },
    { id: 'line', label: 'Line', icon: TrendingUp },
    { id: 'pie', label: 'Pie', icon: PieChart },
    { id: 'scatter', label: 'Scatter', icon: Activity },
  ];

  return (
    <div
      className={`w-full my-4 p-4 rounded-xl border shadow-sm overflow-hidden transition-colors ${
        isLight
          ? 'bg-slate-50/80 border-slate-200/90'
          : 'bg-slate-900/90 border-slate-800'
      }`}
    >
      {/* Top Toolbar: Title + On-the-Fly Chart Type Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-600 inline-block"></span>
          <h4
            className={`text-xs font-bold ${
              isLight ? 'text-slate-800' : 'text-slate-200'
            }`}
          >
            {title || `${selectedY} by ${selectedX}`}
          </h4>
        </div>

        {/* Chart Type Segmented Control */}
        <div
          className={`flex items-center gap-1 p-1 rounded-lg border ${
            isLight
              ? 'bg-white border-slate-200'
              : 'bg-slate-950 border-slate-800'
          }`}
        >
          {chartTypes.map((ct) => {
            const Icon = ct.icon;
            const active = activeChartType === ct.id;
            return (
              <button
                key={ct.id}
                type="button"
                onClick={() => setActiveChartType(ct.id)}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition ${
                  active
                    ? 'bg-blue-600 text-white shadow-xs'
                    : isLight
                    ? 'text-slate-600 hover:bg-slate-100'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
                title={`Switch to ${ct.label} Chart`}
              >
                <Icon className="w-3 h-3" />
                <span>{ct.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Optional Axis Switcher if query returned 3+ columns */}
      {availableColumns.length > 2 && (
        <div className="flex flex-wrap items-center gap-3 mb-2 text-[11px]">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-medium">X-Axis:</span>
            <select
              value={selectedX}
              onChange={(e) => setSelectedX(e.target.value)}
              className={`px-2 py-0.5 rounded border font-mono text-[11px] focus:outline-none focus:border-blue-500 ${
                isLight
                  ? 'bg-white border-slate-200 text-slate-700'
                  : 'bg-slate-950 border-slate-800 text-slate-300'
              }`}
            >
              {availableColumns.map((col) => (
                <option key={col} value={col}>
                  {col}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-medium">Y-Axis:</span>
            <select
              value={selectedY}
              onChange={(e) => setSelectedY(e.target.value)}
              className={`px-2 py-0.5 rounded border font-mono text-[11px] focus:outline-none focus:border-blue-500 ${
                isLight
                  ? 'bg-white border-slate-200 text-slate-700'
                  : 'bg-slate-950 border-slate-800 text-slate-300'
              }`}
            >
              {availableColumns.map((col) => (
                <option key={col} value={col}>
                  {col}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Plotly Canvas */}
      <div className="w-full min-h-[320px]">
        <Plot
          data={plotData as any}
          layout={{
            autosize: true,
            margin: { l: 50, r: 25, t: 25, b: 60 },
            paper_bgcolor: 'transparent',
            plot_bgcolor: 'transparent',
            font: {
              family: 'inherit',
              color: isLight ? '#475569' : '#94a3b8',
              size: 11,
            },
            xaxis: {
              gridcolor: isLight ? '#e2e8f0' : '#1e293b',
              tickangle: -20,
              zerolinecolor: isLight ? '#cbd5e1' : '#334155',
            },
            yaxis: {
              gridcolor: isLight ? '#e2e8f0' : '#1e293b',
              zerolinecolor: isLight ? '#cbd5e1' : '#334155',
            },
          }}
          useResizeHandler={true}
          style={{ width: '100%', height: '320px' }}
          config={{
            responsive: true,
            displayModeBar: true,
            displaylogo: false,
            modeBarButtonsToRemove: ['lasso2d', 'select2d'],
          }}
        />
      </div>
    </div>
  );
};
