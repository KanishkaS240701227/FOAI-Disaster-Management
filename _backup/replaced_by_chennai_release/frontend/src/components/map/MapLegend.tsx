import React from 'react';

export const MapLegend: React.FC = () => {
  return (
    <div className="glass-panel p-3 text-xs flex flex-wrap items-center justify-between gap-4 border border-slate-200 dark:border-slate-800">
      <div className="flex items-center gap-4 flex-wrap">
        <span className="font-bold text-slate-700 dark:text-slate-300">Map Legend:</span>

        {/* Nodes */}
        <div className="flex items-center gap-1.5">
          <div className="w-3.5 h-3.5 rounded bg-blue-600 flex items-center justify-center text-[8px] text-white font-bold">
            🏢
          </div>
          <span className="text-slate-600 dark:text-slate-400">Warehouse Depot</span>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-600" />
          <span className="text-slate-600 dark:text-slate-400">Critical Area</span>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-orange-500" />
          <span className="text-slate-600 dark:text-slate-400">High Severity</span>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-amber-500" />
          <span className="text-slate-600 dark:text-slate-400">Medium Severity</span>
        </div>

        {/* Roads */}
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-1 bg-emerald-500 rounded" />
          <span className="text-slate-600 dark:text-slate-400">Open Road</span>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="w-4 h-1 bg-red-500 border-b border-dashed border-red-800" />
          <span className="text-red-600 dark:text-red-400 font-bold">Blocked (A* Avoids)</span>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="w-4 h-1 bg-amber-500 rounded" />
          <span className="text-amber-600 dark:text-amber-400">Under Repair</span>
        </div>

        {/* Routes */}
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-1.5 bg-blue-600 rounded" />
          <span className="text-blue-600 dark:text-blue-400 font-bold">AI Selected Route</span>
        </div>
      </div>
    </div>
  );
};
