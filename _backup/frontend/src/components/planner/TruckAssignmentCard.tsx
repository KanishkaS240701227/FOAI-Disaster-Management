import React from 'react';
import {
  Truck,
  MapPin,
  Clock,
  Fuel,
  Weight,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { TruckPlanOutput } from '../../types';
import { SeverityBadge } from '../common/Badge';

interface Props {
  plan: TruckPlanOutput;
  index: number;
}

export const TruckAssignmentCard: React.FC<Props> = ({ plan, index }) => {
  const [expanded, setExpanded] = React.useState(false);

  const hasOverload = plan.overload_units > 0;
  const hasFuelOveruse = plan.fuel_overuse_liters > 0;

  return (
    <div
      className={`glass-panel p-4 border transition-all duration-200 ${
        hasOverload || hasFuelOveruse
          ? 'border-red-300 dark:border-red-900 bg-red-50/10'
          : 'border-slate-200 dark:border-slate-800 hover:border-blue-500/50'
      }`}
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Truck Header & Badge */}
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
              <Truck className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  {plan.truck_number}
                </h4>
                <SeverityBadge severity={plan.priority_level} />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Depot: <span className="font-semibold text-slate-700 dark:text-slate-300">{plan.warehouse_name}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Route Chain */}
        <div className="flex-1 lg:max-w-md">
          <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
            Dispatch Sequence ({plan.assigned_locations.length} stops):
          </label>
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950 font-bold text-blue-800 dark:text-blue-300 text-[11px]">
              DEPOT
            </span>
            {plan.assigned_location_names.map((name, i) => (
              <React.Fragment key={i}>
                <ArrowRight className="w-3 h-3 text-slate-400" />
                <span className="px-2 py-0.5 rounded bg-orange-100 text-orange-800 dark:bg-orange-950/80 dark:text-orange-300 font-semibold text-[11px]">
                  {name}
                </span>
              </React.Fragment>
            ))}
            <ArrowRight className="w-3 h-3 text-slate-400" />
            <span className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950 font-bold text-blue-800 dark:text-blue-300 text-[11px]">
              DEPOT
            </span>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-3 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-center">
            <span className="text-slate-400 flex items-center justify-center gap-1 text-[10px] uppercase font-bold">
              <MapPin className="w-3 h-3 text-orange-500" /> Dist
            </span>
            <p className="font-extrabold text-slate-900 dark:text-white mt-0.5">
              {plan.distance_km} km
            </p>
          </div>

          <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-center">
            <span className="text-slate-400 flex items-center justify-center gap-1 text-[10px] uppercase font-bold">
              <Clock className="w-3 h-3 text-blue-500" /> Time
            </span>
            <p className="font-extrabold text-slate-900 dark:text-white mt-0.5">
              {plan.estimated_time_hours} hrs
            </p>
          </div>

          <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-center">
            <span className="text-slate-400 flex items-center justify-center gap-1 text-[10px] uppercase font-bold">
              <Fuel className="w-3 h-3 text-purple-500" /> Fuel
            </span>
            <p className="font-extrabold text-slate-900 dark:text-white mt-0.5">
              {plan.fuel_usage_liters} L
            </p>
          </div>
        </div>

        {/* Toggle Details Button */}
        <div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
            title="Expand stop breakdown"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Capacity Progress Bar */}
      <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800/80">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-slate-500 font-medium flex items-center gap-1.5">
            <Weight className="w-3.5 h-3.5 text-slate-400" />
            Payload Load: <b>{plan.total_load_units.toLocaleString()} / {plan.capacity_limit.toLocaleString()} units</b>
          </span>
          <span
            className={`font-bold ${
              plan.capacity_utilization_pct > 100
                ? 'text-red-600'
                : plan.capacity_utilization_pct > 80
                ? 'text-orange-500'
                : 'text-blue-600'
            }`}
          >
            {plan.capacity_utilization_pct}% Utilized
          </span>
        </div>
        <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
          <div
            style={{ width: `${Math.min(100, plan.capacity_utilization_pct)}%` }}
            className={`h-full rounded-full transition-all duration-300 ${
              plan.capacity_utilization_pct > 100
                ? 'bg-red-500'
                : plan.capacity_utilization_pct > 80
                ? 'bg-orange-500'
                : 'bg-blue-600'
            }`}
          />
        </div>
      </div>

      {/* Expanded Stop-by-Stop Resource Allocation */}
      {expanded && (
        <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3 animate-fade-in text-xs">
          <h5 className="font-bold uppercase text-[10px] text-slate-400">
            Per-Stop Delivered Supplies Breakdown:
          </h5>
          <div className="space-y-2">
            {plan.stops_detail.map((stop, i) => (
              <div
                key={i}
                className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-orange-500 text-white font-bold text-[10px] flex items-center justify-center">
                    {i + 1}
                  </span>
                  <div>
                    <p className="font-bold text-slate-800 dark:text-slate-200">{stop.location_name}</p>
                    <SeverityBadge severity={stop.severity} />
                  </div>
                </div>

                <div className="flex items-center gap-3 text-[11px] text-slate-600 dark:text-slate-400 font-medium">
                  <span>🥖 Food: <b>{stop.delivered.food}</b></span>
                  <span>💧 Water: <b>{stop.delivered.water}</b></span>
                  <span>💊 Meds: <b>{stop.delivered.medicine}</b></span>
                  <span>🧣 Blankets: <b>{stop.delivered.blankets}</b></span>
                  <span>🧰 Kits: <b>{stop.delivered.emergency_kits}</b></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
