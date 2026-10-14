import React, { useState, useEffect } from 'react';
import {
  Network,
  Plus,
  Edit2,
  Trash2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { api } from '../services/api';
import { Road, Warehouse, AffectedArea } from '../types';
import { Button } from '../components/common/Button';
import { RoadStatusBadge } from '../components/common/Badge';
import { RoadModal } from '../components/roads/RoadModal';
import { LoadingSpinner } from '../components/common/LoadingSpinner';

export const RoadNetworkPage: React.FC = () => {
  const [roads, setRoads] = useState<Road[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [affectedAreas, setAffectedAreas] = useState<AffectedArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedRoad, setSelectedRoad] = useState<Road | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [r, w, a] = await Promise.all([
        api.getRoads(),
        api.getWarehouses(),
        api.getAffectedAreas(),
      ]);
      setRoads(r);
      setWarehouses(w);
      setAffectedAreas(a);
    } catch (err) {
      console.error('Failed to load roads:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const nameMap = new Map<string, string>();
  warehouses.forEach((w) => nameMap.set(w.id, w.name));
  affectedAreas.forEach((a) => nameMap.set(a.id, a.name));

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to remove this road segment?')) return;
    try {
      await api.deleteRoad(id);
      loadData();
    } catch (err) {
      console.error('Failed to delete road:', err);
    }
  };

  const filtered = roads.filter((r) => {
    const s = r.road_status || r.status || 'Open';
    return statusFilter === 'ALL' || s === statusFilter;
  });

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="glass-panel p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Network className="w-5 h-5 text-blue-500" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Road Network & Arterial Infrastructure
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Manage interconnecting routes, distance, road damage conditions, and emergency blocked segments.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
          >
            <option value="ALL">All Road Statuses</option>
            <option value="Open">Open Roads Only</option>
            <option value="Blocked">Blocked Roads (Pruned by A*)</option>
            <option value="Under Repair">Under Repair Only</option>
          </select>

          <Button
            onClick={() => {
              setSelectedRoad(null);
              setModalOpen(true);
            }}
            icon={Plus}
            size="sm"
          >
            Add Road Link
          </Button>
        </div>
      </div>

      {loading && <LoadingSpinner message="Loading road network topology..." />}

      {/* Roads Table */}
      <div className="glass-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-slate-400 font-bold uppercase text-[10px]">
                <th className="py-3 px-4">Origin / Source</th>
                <th className="py-3 px-4">Direction</th>
                <th className="py-3 px-4">Destination</th>
                <th className="py-3 px-4">Distance (km)</th>
                <th className="py-3 px-4">Est. Time</th>
                <th className="py-3 px-4">Condition</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map((road) => {
                const srcName = nameMap.get(road.source_id) || road.source_id;
                const dstName = nameMap.get(road.destination_id) || road.destination_id;
                const st = (road.road_status || road.status || 'Open') as any;
                const cond = road.road_condition || road.condition || 'Paved';

                return (
                  <tr
                    key={road.id}
                    className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors ${
                      st === 'Blocked' ? 'bg-red-50/20 dark:bg-red-950/20' : ''
                    }`}
                  >
                    <td className="py-3 px-4 font-bold text-slate-800 dark:text-slate-200">
                      {srcName}
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      {road.one_way ? <ArrowRight className="w-4 h-4 text-orange-500" /> : '⟷'}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-800 dark:text-slate-200">
                      {dstName}
                    </td>
                    <td className="py-3 px-4 font-mono">{road.distance} km</td>
                    <td className="py-3 px-4 font-mono">{road.travel_time} hrs</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {cond}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <RoadStatusBadge status={st} />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => {
                            setSelectedRoad(road);
                            setModalOpen(true);
                          }}
                          className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(road.id)}
                          className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/50 text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <RoadModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        road={selectedRoad}
        warehouses={warehouses}
        affectedAreas={affectedAreas}
        onSaved={loadData}
      />
    </div>
  );
};
