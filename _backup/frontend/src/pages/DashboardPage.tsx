import React, { useState, useEffect } from 'react';
import {
  Warehouse as WarehouseIcon,
  AlertOctagon,
  Truck,
  Activity,
  Fuel,
  Compass,
  Zap,
  Sparkles,
  Play,
  ArrowRight,
  ShieldAlert,
  Download,
  Layers,
} from 'lucide-react';
import { api } from '../services/api';
import {
  DashboardStats,
  Warehouse,
  AffectedArea,
  Road,
  Truck as TruckType,
  DistributionPlanResponse,
} from '../types';
import { StatCard } from '../components/common/StatCard';
import { Button } from '../components/common/Button';
import { ReliefMap } from '../components/map/ReliefMap';
import { MapLegend } from '../components/map/MapLegend';
import { LoadingSpinner } from '../components/common/LoadingSpinner';

interface Props {
  onNavigate: (tab: string) => void;
  onPlanGenerated?: (plan: DistributionPlanResponse) => void;
}

export const DashboardPage: React.FC<Props> = ({
  onNavigate,
  onPlanGenerated,
}) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [affectedAreas, setAffectedAreas] = useState<AffectedArea[]>([]);
  const [roads, setRoads] = useState<Road[]>([]);
  const [trucks, setTrucks] = useState<TruckType[]>([]);
  const [latestPlan, setLatestPlan] = useState<DistributionPlanResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const loadAllData = async () => {
    try {
      setLoading(true);
      const [s, w, a, r, t] = await Promise.all([
        api.getDashboardStats(),
        api.getWarehouses(),
        api.getAffectedAreas(),
        api.getRoads(),
        api.getTrucks(),
      ]);
      setStats(s);
      setWarehouses(w);
      setAffectedAreas(a);
      setRoads(r);
      setTrucks(t);

      // Attempt to load latest plan
      try {
        const p = await api.getLatestPlan();
        if (p && p.details) {
          setLatestPlan({
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
            message: 'Latest saved plan loaded',
          });
        }
      } catch {
        // No latest plan exists yet
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const handleQuickDispatch = async () => {
    try {
      setGenerating(true);
      const plan = await api.generatePlan({
        population_size: 100,
        generations: 300,
        mutation_rate: 0.05,
        crossover_rate: 0.80,
      });
      setLatestPlan(plan);
      if (onPlanGenerated) onPlanGenerated(plan);
      // Refresh stats
      const newStats = await api.getDashboardStats();
      setStats(newStats);
    } catch (err) {
      console.error('Failed to generate plan:', err);
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Connecting to Emergency Operations Center..." />;
  }

  const criticalCount = affectedAreas.filter((a) => a.severity === 'Critical').length;
  const blockedRoadCount = roads.filter((r) => (r.road_status || r.status) === 'Blocked').length;

  return (
    <div className="space-y-6">
      {/* Emergency Alert Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-orange-500 via-orange-600 to-blue-700 text-white shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center font-bold text-lg animate-pulse">
            🚨
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold tracking-tight">
                Emergency Incident Command Active
              </h2>
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-white/20">
                Live EOC
              </span>
            </div>
            <p className="text-xs text-white/90 mt-0.5">
              {criticalCount} Critical impact zone(s) identified. {blockedRoadCount} blocked arterial road(s) isolated.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onNavigate('planner')}
            className="bg-white text-slate-900 hover:bg-white/90 border-transparent text-xs"
            icon={Sparkles}
          >
            Open Planner
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={handleQuickDispatch}
            loading={generating}
            className="bg-slate-950 text-white hover:bg-black text-xs"
            icon={Play}
          >
            Generate AI Distribution Plan
          </Button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Warehouses"
          value={stats?.total_warehouses || 0}
          subtitle="Active Supply Depots"
          icon={WarehouseIcon}
          color="blue"
          onClick={() => onNavigate('warehouses')}
        />
        <StatCard
          title="Affected Locations"
          value={stats?.total_affected_locations || 0}
          subtitle={`${criticalCount} Critical Priority`}
          icon={AlertOctagon}
          color="orange"
          onClick={() => onNavigate('affected')}
        />
        <StatCard
          title="Fleet Trucks"
          value={`${stats?.available_trucks || 0} / ${stats?.total_trucks || 0}`}
          subtitle="Available for Dispatch"
          icon={Truck}
          color="emerald"
          onClick={() => onNavigate('trucks')}
        />
        <StatCard
          title="Overall Efficiency"
          value={`${stats?.overall_delivery_efficiency_pct || 0}%`}
          subtitle={`Coverage: ${stats?.coverage_percentage || 0}%`}
          icon={Activity}
          color="purple"
          onClick={() => onNavigate('planner')}
        />
      </div>

      {/* Secondary Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-panel p-4 flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase">Total Planned Distance</span>
            <p className="text-xl font-black text-slate-900 dark:text-white">
              {stats?.total_travel_distance_km ? `${stats.total_travel_distance_km.toFixed(1)} km` : '0 km'}
            </p>
          </div>
          <Compass className="w-8 h-8 text-blue-500 opacity-80" />
        </div>

        <div className="glass-panel p-4 flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase">Estimated Fuel Usage</span>
            <p className="text-xl font-black text-slate-900 dark:text-white">
              {stats?.estimated_fuel_usage_liters ? `${stats.estimated_fuel_usage_liters.toFixed(1)} L` : '0 L'}
            </p>
          </div>
          <Fuel className="w-8 h-8 text-purple-500 opacity-80" />
        </div>

        <div className="glass-panel p-4 flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase">Total Supply Stock</span>
            <p className="text-xl font-black text-slate-900 dark:text-white">
              {stats?.total_resources_stock
                ? (
                    stats.total_resources_stock.food +
                    stats.total_resources_stock.water +
                    stats.total_resources_stock.medicine +
                    stats.total_resources_stock.blankets +
                    stats.total_resources_stock.emergency_kits
                  ).toLocaleString()
                : 0}{' '}
              units
            </p>
          </div>
          <Layers className="w-8 h-8 text-emerald-500 opacity-80" />
        </div>
      </div>

      {/* Interactive Map Preview Card */}
      <div className="glass-panel p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Live Tactical Disaster GIS Map
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Warehouses, Impact Zones, Road status (Green = Open, Red = Blocked), and AI-generated truck delivery routes.
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onNavigate('map')}
            className="text-xs"
          >
            Open Fullscreen Map
          </Button>
        </div>

        <ReliefMap
          warehouses={warehouses}
          affectedAreas={affectedAreas}
          roads={roads}
          truckPlans={latestPlan?.truck_plans}
          height="450px"
        />

        <MapLegend />
      </div>
    </div>
  );
};
