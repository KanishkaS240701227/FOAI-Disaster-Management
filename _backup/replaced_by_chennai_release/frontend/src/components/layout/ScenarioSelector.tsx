import React, { useEffect, useState } from 'react';
import { ShieldAlert, RefreshCw, CheckCircle2 } from 'lucide-react';
import { api } from '../../services/api';
import { ScenarioPreset } from '../../types';

interface Props {
  onScenarioLoaded?: () => void;
}

export const ScenarioSelector: React.FC<Props> = ({ onScenarioLoaded }) => {
  const [scenarios, setScenarios] = useState<ScenarioPreset[]>([]);
  const [selectedKey, setSelectedKey] = useState<string>('cyclone');
  const [loading, setLoading] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    api.getScenarios().then(setScenarios).catch(console.error);
  }, []);

  const handleLoadScenario = async (key: string) => {
    try {
      setLoading(true);
      setSelectedKey(key);
      await api.loadScenario(key);
      setSuccessMsg(`Loaded scenario preset.`);
      setTimeout(() => setSuccessMsg(null), 3000);
      if (onScenarioLoaded) onScenarioLoaded();
    } catch (err) {
      console.error('Failed to load scenario:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <div className="relative flex items-center">
        <ShieldAlert className="w-4 h-4 text-orange-500 absolute left-2.5 pointer-events-none" />
        <select
          value={selectedKey}
          onChange={(e) => handleLoadScenario(e.target.value)}
          disabled={loading}
          className="pl-8 pr-8 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer transition-all"
        >
          {scenarios.map((s) => (
            <option key={s.key} value={s.key}>
              Scenario: {s.name}
            </option>
          ))}
        </select>
      </div>

      <button
        onClick={() => handleLoadScenario(selectedKey)}
        disabled={loading}
        title="Reset & reload current disaster scenario data"
        className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors disabled:opacity-50"
      >
        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-orange-500' : ''}`} />
      </button>

      {successMsg && (
        <span className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium animate-fade-in">
          <CheckCircle2 className="w-3.5 h-3.5" />
          {successMsg}
        </span>
      )}
    </div>
  );
};
