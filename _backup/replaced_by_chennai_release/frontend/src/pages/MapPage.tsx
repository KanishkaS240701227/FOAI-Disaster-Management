import React, { useState, useEffect } from 'react';
import { Map as MapIcon, Filter, Layers, RefreshCw } from 'lucide-react';
import { api } from '../services/api';
import { Warehouse, AffectedArea, Road, DistributionPlanResponse } from '../types';
import { ReliefMap } from '../components/map/ReliefMap';
import { MapLegend } from '../components/map/MapLegend';
import { LoadingSpinner } from '../components/common/LoadingSpinner';

export const MapPage: React.FC = () => {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [affectedAreas, setAffectedAreas] = useState<AffectedArea[]>([]);
  const [roads, setRoads] = useState<Road[]>([]);
  const [plan, setPlan] = useState<DistributionPlanResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const [w, a, r] = await Promise.all([
        api.getWarehouses(),
        api.getAffectedAreas(),
        api.getRoads(),
      ]);
      setWarehouses(w);
      setAffectedAreas(a);
      setRoads(r);

      try {
        const p = await api.getLatestPlan();
        if (p && p.details) {
          setPlan({
            plan_id: p.id,
            scenario_name: p.name,
            created_at: p.created_at,
            total_distance_km: p.total_distance_km,
            total_fuel_liters: p.total_fuel_liters,
            total_travel_time_hours: p.total_travel_time_hours,
            overall_efficiency_pct: p.overall_efficiency_pct,
            coverage_pct: p.coverage_pct,
            total_resources_delivered: p.total_resources_delivered,
            total_demand_units: 0,
            truck_plans: p.details.truck_plans || [],
            generation_history: p.details.generation_history || [],
            unmet_demands: p.details.unmet_demands || {},
            algorithm_parameters: p.details.algorithm_parameters || {},
            warnings: p.details.warnings || [],
            message: 'Loaded previous plan',
          });
        }
      } catch {}
    } catch (err) {
      console.error('Failed to load map data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return <LoadingSpinner message="Rendering GIS Disaster Map & Road Network..." />;
  }

  return (
    <div className="space-y-4">
      <div className="glass-panel p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapIcon className="w-5 h-5 text-orange-500" />
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Tactical Disaster GIS Command Map
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Interactive Leaflet visualization of relief logistics, road blocks, and optimal routes.
            </p>
          </div>
        </div>

        <button
          onClick={loadData}
          className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          title="Refresh map"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <ReliefMap
        warehouses={warehouses}
        affectedAreas={affectedAreas}
        roads={roads}
        truckPlans={plan?.truck_plans}
        height="680px"
      />

      <MapLegend />
    </div>
  );
};
