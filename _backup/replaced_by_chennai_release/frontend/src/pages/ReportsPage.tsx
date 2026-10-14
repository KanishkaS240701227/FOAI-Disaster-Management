import React, { useState, useEffect } from 'react';
import {
  FileText,
  Download,
  CheckCircle2,
  Calendar,
  Compass,
  Fuel,
  Activity,
  Award,
} from 'lucide-react';
import { api } from '../services/api';
import { DistributionPlanResponse } from '../types';
import { Button } from '../components/common/Button';
import { LoadingSpinner } from '../components/common/LoadingSpinner';

export const ReportsPage: React.FC = () => {
  const [plan, setPlan] = useState<DistributionPlanResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getLatestPlan()
      .then((p) => {
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
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <LoadingSpinner message="Loading Incident Reports & Logs..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="glass-panel p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Incident Action Reports & Export Center
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Official operational summaries, truck dispatch sequences, and downloadable audit-ready PDF reports.
          </p>
        </div>

        <a
          href={api.downloadPdfReportUrl(plan?.plan_id)}
          download={`Disaster_Relief_Report_${plan?.plan_id || 'latest'}.pdf`}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-orange-500 to-blue-600 hover:from-orange-600 hover:to-blue-700 text-white shadow-md shadow-orange-500/20 transition-transform active:scale-95"
        >
          <Download className="w-4 h-4" />
          <span>Download PDF Action Plan</span>
        </a>
      </div>

      {plan ? (
        <div className="space-y-6">
          {/* Executive Summary Card */}
          <div className="glass-panel p-6 space-y-4 border-l-4 border-blue-600">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-orange-600 dark:text-orange-400">
                  Incident Action Plan
                </span>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {plan.scenario_name}
                </h3>
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {plan.created_at}
              </span>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              This operational report provides the dispatch plan calculated via <b>Classical A* Search</b> and <b>Genetic Algorithm Optimization</b> (300 generations, 100 population). Blocked roadways have been systematically pruned, and resources are allocated to maximize critical demand coverage while penalizing truck overloads and fuel limits.
            </p>

            {/* KPI Banner */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-center border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] uppercase font-bold text-slate-400">Coverage</span>
                <p className="text-lg font-extrabold text-blue-600 dark:text-blue-400 mt-0.5">
                  {plan.coverage_pct}%
                </p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-center border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] uppercase font-bold text-slate-400">Total Distance</span>
                <p className="text-lg font-extrabold text-slate-900 dark:text-white mt-0.5">
                  {plan.total_distance_km} km
                </p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-center border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] uppercase font-bold text-slate-400">Total Fuel</span>
                <p className="text-lg font-extrabold text-slate-900 dark:text-white mt-0.5">
                  {plan.total_fuel_liters} L
                </p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-center border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] uppercase font-bold text-slate-400">Resources Delivered</span>
                <p className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {plan.total_resources_delivered.toLocaleString()} units
                </p>
              </div>
            </div>
          </div>

          {/* Truck Route Table */}
          <div className="glass-panel p-5 space-y-3">
            <h4 className="text-xs font-bold uppercase text-slate-700 dark:text-slate-300">
              Optimal Truck Deployment Schedules:
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-400 font-bold uppercase text-[10px]">
                    <th className="pb-2">Truck ID</th>
                    <th className="pb-2">Home Depot</th>
                    <th className="pb-2">Assigned Stops Sequence</th>
                    <th className="pb-2">Distance</th>
                    <th className="pb-2">Travel Time</th>
                    <th className="pb-2">Fuel Consumed</th>
                    <th className="pb-2">Payload Load</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {plan.truck_plans.map((t) => (
                    <tr key={t.truck_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="py-2.5 font-bold text-blue-600 dark:text-blue-400">
                        {t.truck_number}
                      </td>
                      <td className="py-2.5 font-medium text-slate-700 dark:text-slate-300">
                        {t.warehouse_name}
                      </td>
                      <td className="py-2.5 font-medium">
                        {t.assigned_location_names.join(' ➔ ') || 'Standby'}
                      </td>
                      <td className="py-2.5 font-mono">{t.distance_km} km</td>
                      <td className="py-2.5 font-mono">{t.estimated_time_hours} hrs</td>
                      <td className="py-2.5 font-mono">{t.fuel_usage_liters} L</td>
                      <td className="py-2.5 font-mono">
                        {t.total_load_units} / {t.capacity_limit} ({t.capacity_utilization_pct}%)
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="glass-panel p-12 text-center text-xs text-slate-400 space-y-2">
          <p>No distribution plan generated yet.</p>
          <p>Head to the Distribution Planner tab and click &quot;Generate Distribution Plan&quot; to produce reports.</p>
        </div>
      )}
    </div>
  );
};
