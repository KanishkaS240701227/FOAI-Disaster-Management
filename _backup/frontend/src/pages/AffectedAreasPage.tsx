import React, { useState, useEffect } from 'react';
import {
  AlertOctagon,
  Plus,
  Edit2,
  Trash2,
  Search,
  MapPin,
  Users,
} from 'lucide-react';
import { api } from '../services/api';
import { AffectedArea, SeverityLevel } from '../types';
import { Button } from '../components/common/Button';
import { SeverityBadge } from '../components/common/Badge';
import { AffectedAreaModal } from '../components/affected/AffectedAreaModal';
import { LoadingSpinner } from '../components/common/LoadingSpinner';

export const AffectedAreasPage: React.FC = () => {
  const [areas, setAreas] = useState<AffectedArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedArea, setSelectedArea] = useState<AffectedArea | null>(null);

  const loadAreas = async () => {
    try {
      setLoading(true);
      const data = await api.getAffectedAreas();
      setAreas(data);
    } catch (err) {
      console.error('Failed to load affected areas:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAreas();
  }, []);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this disaster area? Connected roads will also be removed.')) {
      return;
    }
    try {
      await api.deleteAffectedArea(id);
      loadAreas();
    } catch (err) {
      console.error('Failed to delete area:', err);
    }
  };

  const filtered = areas.filter((a) => {
    const matchesSearch = a.name.toLowerCase().includes(search.toLowerCase());
    const matchesSeverity = severityFilter === 'ALL' || a.severity === severityFilter;
    return matchesSearch && matchesSeverity;
  });

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="glass-panel p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <AlertOctagon className="w-5 h-5 text-red-500" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Disaster Impact Zones & Communities
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Manage disaster-affected populations, severity levels, and urgent resource demands.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Severity Filter */}
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
          >
            <option value="ALL">All Severities</option>
            <option value="Critical">Critical Only</option>
            <option value="High">High Only</option>
            <option value="Medium">Medium Only</option>
            <option value="Low">Low Only</option>
          </select>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search zones..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-3 py-1.5 text-xs rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          <Button
            onClick={() => {
              setSelectedArea(null);
              setModalOpen(true);
            }}
            icon={Plus}
            size="sm"
          >
            Add Disaster Zone
          </Button>
        </div>
      </div>

      {loading && <LoadingSpinner message="Loading disaster zones..." />}

      {/* Grid of Disaster Areas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((area) => {
          const totDemand =
            area.food_demand +
            area.water_demand +
            area.medicine_demand +
            area.blanket_demand +
            area.emergency_kit_demand;

          return (
            <div
              key={area.id}
              className="glass-panel p-5 space-y-4 hover:border-orange-500/50 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      {area.name}
                    </h3>
                    <SeverityBadge severity={area.severity} />
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-blue-500" />
                      Pop: <b>{area.population.toLocaleString()}</b>
                    </span>
                    <span className="flex items-center gap-1 font-mono text-[11px]">
                      <MapPin className="w-3.5 h-3.5 text-orange-500" />
                      {area.latitude.toFixed(4)}, {area.longitude.toFixed(4)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setSelectedArea(area);
                      setModalOpen(true);
                    }}
                    className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
                    title="Edit Area"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(area.id)}
                    className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/50 text-red-500 hover:text-red-700 transition-colors"
                    title="Delete Area"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Resource Demands Matrix */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase">
                  <span>Urgent Demand Requirements</span>
                  <span className="text-slate-700 dark:text-slate-300">
                    Total: {totDemand.toLocaleString()} units
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <div className="p-1.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 block">🥖 Food:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {area.food_demand.toLocaleString()}
                    </span>
                  </div>
                  <div className="p-1.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 block">💧 Water:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {area.water_demand.toLocaleString()}
                    </span>
                  </div>
                  <div className="p-1.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 block">💊 Medicine:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {area.medicine_demand.toLocaleString()}
                    </span>
                  </div>
                  <div className="p-1.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 block">🧣 Blankets:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {area.blanket_demand.toLocaleString()}
                    </span>
                  </div>
                  <div className="p-1.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 block">🧰 Emergency Kits:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {area.emergency_kit_demand.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <AffectedAreaModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        area={selectedArea}
        onSaved={loadAreas}
      />
    </div>
  );
};
