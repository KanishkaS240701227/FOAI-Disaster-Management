import React from 'react';
import {
  LayoutDashboard,
  Sparkles,
  Map as MapIcon,
  Route,
  Warehouse,
  AlertOctagon,
  Network,
  Truck,
  FileText,
} from 'lucide-react';

interface Props {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<Props> = ({
  activeTab,
  onSelectTab,
  isOpen,
  onClose,
}) => {
  const navItems = [
    { id: 'dashboard', label: 'Operations Dashboard', icon: LayoutDashboard, section: 'COMMAND' },
    { id: 'planner', label: 'Distribution Planner', icon: Sparkles, badge: 'AI Engine', section: 'COMMAND' },
    { id: 'map', label: 'Tactical GIS Map', icon: MapIcon, section: 'COMMAND' },

    { id: 'visualizer-astar', label: 'A* Search Visualizer', icon: Route, badge: 'Classical AI', section: 'ALGORITHM LAB' },

    { id: 'warehouses', label: 'Depots & Warehouses', icon: Warehouse, section: 'INFRASTRUCTURE' },
    { id: 'affected', label: 'Disaster Affected Areas', icon: AlertOctagon, section: 'INFRASTRUCTURE' },
    { id: 'roads', label: 'Road Network & Blocks', icon: Network, section: 'INFRASTRUCTURE' },
    { id: 'trucks', label: 'Fleet & Relief Trucks', icon: Truck, section: 'INFRASTRUCTURE' },

    { id: 'reports', label: 'PDF Reports & Logs', icon: FileText, section: 'REPORTS' },
  ];

  const grouped = navItems.reduce((acc, item) => {
    if (!acc[item.section]) acc[item.section] = [];
    acc[item.section].push(item);
    return acc;
  }, {} as Record<string, typeof navItems>);

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
        />
      )}

      <aside
        className={`fixed lg:static top-0 left-0 bottom-0 z-50 w-64 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] flex flex-col transition-transform duration-300 lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 lg:hidden flex items-center justify-between">
          <span className="font-bold text-sm text-slate-900 dark:text-white">Navigation</span>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs"
          >
            Close
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-5">
          {Object.entries(grouped).map(([section, items]) => (
            <div key={section} className="space-y-1">
              <span className="px-3 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {section}
              </span>
              <div className="space-y-0.5 pt-1">
                {items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        onSelectTab(item.id);
                        onClose();
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                        isActive
                          ? 'bg-gradient-to-r from-orange-500 to-blue-600 text-white shadow-sm shadow-orange-500/20'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400 dark:text-slate-500'}`} />
                        <span>{item.label}</span>
                      </div>
                      {item.badge && (
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                            isActive
                              ? 'bg-white/20 text-white'
                              : 'bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer info */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
          <div className="flex items-center justify-between font-medium">
            <span>AI Algorithms:</span>
            <span className="text-orange-600 dark:text-orange-400 font-bold">A* + GA Only</span>
          </div>
          <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500">
            <span>Machine Learning:</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">0% (Pure Classical)</span>
          </div>
        </div>
      </aside>
    </>
  );
};
