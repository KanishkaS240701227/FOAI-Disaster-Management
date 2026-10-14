import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Play,
  Download,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Truck,
  Layers,
  MapPin,
  Clock,
  Fuel,
  Compass,
} from 'lucide-react';
import { api } from '../services/api';
import {
  DistributionPlanResponse,
  Warehouse,
  AffectedArea,
  Road,
} from '../types';
import { Button } from '../components/common/Button';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { TruckAssignmentCard } from '../components/planner/TruckAssignmentCard';
import { ResourceFulfillmentTable } from '../components/planner/ResourceFulfillmentTable';
import { AlertBanner } from '../components/common/AlertBanner';
import { ReliefMap } from '../components/map/ReliefMap';

interface Props {
  initialPlan?: DistributionPlanResponse | null;
  onPlanGenerated?: (plan: DistributionPlanResponse) => void;
}

export const PlannerPage: React.FC<Props> = ({
  initialPlan,
  onPlanGenerated,
}) => {
  const [plan, setPlan] = useState<DistributionPlanResponse | null>(initialPlan || null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [affectedAreas, setAffectedAreas] = useState<AffectedArea[]>([]);
  const [roads, setRoads] = useState<Road[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTruckRoute, setSelectedTruckRoute] = useState<string | null>(null);

  // Optimizer parameters
  const [popSize, setPopSize] = useState(100);
  const [gens, setGens] = useState(300);
  const [mutRate, setMutRate] = useState(0.05);
  const [crossRate, setCrossRate] = useState(0.80);

  useEffect(() => {
    Promise.all([
      api.getWarehouses(),
      api.getAffectedAreas(),
      api.getRoads(),
    ]).then(([w, a, r]) => {
      setWarehouses(w);
      setAffectedAreas(a);
      setRoads(r);
    });

    if (!plan) {
      api.getLatestPlan().then((p) => {
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
      }).catch(() => {});
    }
  }, []);

  const handleGeneratePlan = async () => {
    try {
      setLoading(true);
      const res = await api.generatePlan({
        population_size: popSize,
        generations: gens,
        mutation_rate: mutRate,
        crossover_rate: crossRate,
        scenario_name: 'Emergency Action Plan',
      });
      setPlan(res);
      if (onPlanGenerated) onPlanGenerated(res);
    } catch (err) {
      console.error('Failed to generate distribution plan:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Configuration & Action Card */}
      <div className="glass-panel p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-orange-500" />
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Resource Distribution & Fleet Dispatch Planner
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Execute Pure Classical AI (A* Search & Genetic Algorithm) to generate optimal multi-vehicle routes and supply dispatches.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {plan && (
              <a
                href={api.downloadPdfReportUrl(plan.plan_id)}
                download={`Disaster_Relief_Plan_${plan.plan_id}.pdf`}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 transition-colors"
              >
                <Download className="w-4 h-4 text-blue-500" />
                <span>Export PDF Report</span>
              </a>
            )}

            <Button
              onClick={handleGeneratePlan}
              loading={loading}
              icon={Play}
              size="md"
            >
              Generate Distribution Plan
            </Button>
          </div>
        </div>

        {/* Hyperparameter Controls */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs pt-1">
          <div>
            <span className="font-semibold text-slate-500 block mb-1">GA Population: <b>{popSize}</b></span>
            <input
              type="range"
              min="30"
              max="200"
              step="10"
              value={popSize}
              onChange={(e) => setPopSize(Number(e.target.value))}
              className="w-full accent-orange-500 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
            />
          </div>
          <div>
            <span className="font-semibold text-slate-500 block mb-1">GA Generations: <b>{gens}</b></span>
            <input
              type="range"
              min="50"
              max="500"
              step="25"
              value={gens}
              onChange={(e) => setGens(Number(e.target.value))}
              className="w-full accent-orange-500 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
            />
          </div>
          <div>
            <span className="font-semibold text-slate-500 block mb-1">Crossover Rate: <b>{(crossRate * 100).toFixed(0)}%</b></span>
            <input
              type="range"
              min="0.5"
              max="1.0"
              step="0.05"
              value={crossRate}
              onChange={(e) => setCrossRate(Number(e.target.value))}
              className="w-full accent-orange-500 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
            />
          </div>
          <div>
            <span className="font-semibold text-slate-500 block mb-1">Mutation Rate: <b>{(mutRate * 100).toFixed(0)}%</b></span>
            <input
              type="range"
              min="0.01"
              max="0.20"
              step="0.01"
              value={mutRate}
              onChange={(e) => setMutRate(Number(e.target.value))}
              className="w-full accent-orange-500 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
            />
          </div>
        </div>
      </div>

      {loading && (
        <LoadingSpinner
          message="Running A* Shortest Route Search & Genetic Algorithm Optimization..."
          subtext="Evaluating multi-objective fitness across 100 chromosomes over 300 generations..."
        />
      )}

      {/* Plan Warnings */}
      {plan?.warnings && plan.warnings.length > 0 && (
        <div className="space-y-2">
          {plan.warnings.map((w, idx) => (
            <AlertBanner key={idx} type="warning" message={w} />
          ))}
        </div>
      )}

      {/* Generated Solution Summary */}
      {plan && !loading && (
        <div className="space-y-6">
          {/* Mission Overview Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="glass-panel p-3 text-center">
              <span className="text-[10px] uppercase font-bold text-slate-400">Coverage</span>
              <p className="text-xl font-extrabold text-blue-600 dark:text-blue-400 mt-0.5">
                {plan.coverage_pct}%
              </p>
            </div>
            <div className="glass-panel p-3 text-center">
              <span className="text-[10px] uppercase font-bold text-slate-400">Fleet Efficiency</span>
              <p className="text-xl font-extrabold text-orange-600 dark:text-orange-400 mt-0.5">
                {plan.overall_efficiency_pct}%
              </p>
            </div>
            <div className="glass-panel p-3 text-center">
              <span className="text-[10px] uppercase font-bold text-slate-400">Total Distance</span>
              <p className="text-xl font-extrabold text-slate-900 dark:text-white mt-0.5">
                {plan.total_distance_km} km
              </p>
            </div>
            <div className="glass-panel p-3 text-center">
              <span className="text-[10px] uppercase font-bold text-slate-400">Fuel Consumed</span>
              <p className="text-xl font-extrabold text-slate-900 dark:text-white mt-0.5">
                {plan.total_fuel_liters} L
              </p>
            </div>
            <div className="glass-panel p-3 text-center">
              <span className="text-[10px] uppercase font-bold text-slate-400">Mission Time</span>
              <p className="text-xl font-extrabold text-slate-900 dark:text-white mt-0.5">
                {plan.total_travel_time_hours} h
              </p>
            </div>
            <div className="glass-panel p-3 text-center">
              <span className="text-[10px] uppercase font-bold text-slate-400">Supplies Delivered</span>
              <p className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">
                {plan.total_resources_delivered.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Map of Generated Optimal Routes */}
          <div className="glass-panel p-4 space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Generated Optimal Routes Map Overview
            </h3>
            <ReliefMap
              warehouses={warehouses}
              affectedAreas={affectedAreas}
              roads={roads}
              truckPlans={plan.truck_plans}
              selectedRouteId={selectedTruckRoute}
              height="400px"
            />
          </div>

          {/* Truck Deployment Cards */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Optimal Truck Assignments & Waypoints ({plan.truck_plans.length} Dispatched)
            </h3>
            <div className="space-y-3">
              {plan.truck_plans.map((tp, idx) => (
                <TruckAssignmentCard key={tp.truck_id} plan={tp} index={idx} />
              ))}
            </div>
          </div>

          {/* Resource Allocation Matrix */}
          <ResourceFulfillmentTable plan={plan} affectedAreas={affectedAreas} />
        </div>
      )}
    </div>
  );
};
