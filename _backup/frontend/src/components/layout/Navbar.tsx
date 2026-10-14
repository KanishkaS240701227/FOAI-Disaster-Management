import React from 'react';
import {
  Activity,
  Cpu,
  Download,
  AlertTriangle,
  Menu,
} from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { ScenarioSelector } from './ScenarioSelector';
import { api } from '../../services/api';

interface Props {
  onScenarioLoaded?: () => void;
  toggleSidebar?: () => void;
  onNavigate?: (tab: string) => void;
}

export const Navbar: React.FC<Props> = ({
  onScenarioLoaded,
  toggleSidebar,
  onNavigate,
}) => {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-[#111827]/80 backdrop-blur-md px-4 py-2.5 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <button
          onClick={toggleSidebar}
          className="lg:hidden p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div
          onClick={() => onNavigate && onNavigate('dashboard')}
          className="flex items-center gap-2.5 cursor-pointer group"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-blue-600 flex items-center justify-center text-white shadow-md shadow-orange-500/20 group-hover:scale-105 transition-transform">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base tracking-tight text-slate-900 dark:text-white">
                DISASTER RELIEF
              </span>
              <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300 border border-blue-200 dark:border-blue-700">
                Classical AI
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              Resource Distribution & Fleet Dispatch Optimizer
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Scenario preset selector */}
        <div className="hidden sm:block">
          <ScenarioSelector onScenarioLoaded={onScenarioLoaded} />
        </div>

        {/* Quick Report Download */}
        <a
          href={api.downloadPdfReportUrl()}
          download="Disaster_Relief_Action_Plan.pdf"
          className="hidden md:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/50 dark:text-blue-300 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800 transition-colors"
          title="Download Incident Action PDF Report"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Plan PDF</span>
        </a>

        {/* Pure Classical AI badge */}
        <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
          <Cpu className="w-3.5 h-3.5 text-emerald-500" />
          <span>Pure Classical AI (A* & GA) | Zero ML</span>
        </div>

        <ThemeToggle />
      </div>
    </header>
  );
};
