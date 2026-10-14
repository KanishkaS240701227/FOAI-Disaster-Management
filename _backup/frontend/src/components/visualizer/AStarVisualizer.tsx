import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  ChevronRight,
  ChevronLeft,
  Route,
  CheckCircle2,
  AlertCircle,
  Clock,
  Fuel,
  MapPin,
  Layers,
  Sparkles,
} from 'lucide-react';
import { api } from '../../services/api';
import { Warehouse, AffectedArea, AStarVisualizerResponse, AStarStep } from '../../types';
import { Button } from '../common/Button';
import { LoadingSpinner } from '../common/LoadingSpinner';

interface Props {
  warehouses: Warehouse[];
  affectedAreas: AffectedArea[];
}

export const AStarVisualizer: React.FC<Props> = ({ warehouses, affectedAreas }) => {
  const allLocations = [
    ...warehouses.map((w) => ({ id: w.id, name: `${w.name} (Depot)`, type: 'wh' })),
    ...affectedAreas.map((a) => ({ id: a.id, name: `${a.name} (${a.severity})`, type: 'aff' })),
  ];

  const [startId, setStartId] = useState<string>(warehouses[0]?.id || '');
  const [goalId, setGoalId] = useState<string>(affectedAreas[0]?.id || '');
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<AStarVisualizerResponse | null>(null);

  // Playback state
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playSpeed, setPlaySpeed] = useState<number>(800); // ms per step
  const timerRef = useRef<any>(null);

  const handleRunSearch = async () => {
    if (!startId || !goalId) return;
    try {
      setLoading(true);
      setIsPlaying(false);
      const res = await api.visualizeAStar({ start_id: startId, goal_id: goalId });
      setResult(res);
      setCurrentStepIndex(0);
    } catch (err) {
      console.error('Failed to run A*:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isPlaying && result && result.steps_log.length > 0) {
      timerRef.current = setInterval(() => {
        setCurrentStepIndex((prev) => {
          if (prev >= result.steps_log.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, playSpeed);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, result, playSpeed]);

  const currentStep: AStarStep | undefined = result?.steps_log[currentStepIndex];

  return (
    <div className="space-y-6">
      {/* Control Header Card */}
      <div className="glass-panel p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Route className="w-5 h-5 text-orange-500" />
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                A* Heuristic Pathfinding Visualizer
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Step-by-step heuristic graph search with priority queue tracking and blocked road avoidance.
            </p>
          </div>

          {/* Start and Goal selectors */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Start Depot</label>
              <select
                value={startId}
                onChange={(e) => setStartId(e.target.value)}
                className="block text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
              >
                {allLocations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Target Destination</label>
              <select
                value={goalId}
                onChange={(e) => setGoalId(e.target.value)}
                className="block text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700"
              >
                {allLocations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="pt-4">
              <Button onClick={handleRunSearch} loading={loading} icon={Play}>
                Run A* Trace
              </Button>
            </div>
          </div>
        </div>

        {/* Playback Controls (if result ready) */}
        {result && result.steps_log.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setIsPlaying(false);
                  setCurrentStepIndex(0);
                }}
                icon={RotateCcw}
              >
                Reset
              </Button>

              <Button
                variant="secondary"
                size="sm"
                disabled={currentStepIndex === 0}
                onClick={() => {
                  setIsPlaying(false);
                  setCurrentStepIndex((prev) => Math.max(0, prev - 1));
                }}
                icon={ChevronLeft}
              >
                Prev Step
              </Button>

              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsPlaying(!isPlaying)}
                icon={isPlaying ? Pause : Play}
              >
                {isPlaying ? 'Pause' : 'Auto Play'}
              </Button>

              <Button
                variant="secondary"
                size="sm"
                disabled={currentStepIndex === result.steps_log.length - 1}
                onClick={() => {
                  setIsPlaying(false);
                  setCurrentStepIndex((prev) => Math.min(result.steps_log.length - 1, prev + 1));
                }}
                icon={ChevronRight}
              >
                Next Step
              </Button>

              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 ml-2">
                Step {currentStepIndex + 1} of {result.steps_log.length}
              </span>
            </div>

            {/* Speed selection */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500 font-medium">Speed:</span>
              {[1200, 600, 250].map((spd, i) => (
                <button
                  key={spd}
                  onClick={() => setPlaySpeed(spd)}
                  className={`px-2 py-1 rounded text-xs font-semibold ${
                    playSpeed === spd
                      ? 'bg-orange-500 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {i === 0 ? '1x' : i === 1 ? '2x' : '4x'}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {loading && <LoadingSpinner message="Executing Pure Classical A* Search..." />}

      {/* Main Visualizer Content */}
      {result && currentStep && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Step Log & Open/Closed List */}
          <div className="lg:col-span-2 space-y-6">
            {/* Step Action Banner */}
            <div className="glass-panel p-4 border-l-4 border-orange-500 bg-orange-50/20 dark:bg-orange-950/20">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase text-orange-600 dark:text-orange-400">
                  Step #{currentStep.step_num} Evaluation
                </span>
                <span className="text-xs font-mono font-bold bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                  f(n) = g(n) + h(n) = {currentStep.current_g} + {currentStep.current_h} = {currentStep.current_f}
                </span>
              </div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-2">
                {currentStep.action_description}
              </p>
            </div>

            {/* Open List (Priority Queue) */}
            <div className="glass-panel p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-blue-500" />
                  <h4 className="text-xs font-bold uppercase text-slate-700 dark:text-slate-300">
                    Open List (Min-Heap Priority Queue)
                  </h4>
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                  {currentStep.open_list.length} Candidate Node(s)
                </span>
              </div>

              {currentStep.open_list.length === 0 ? (
                <p className="text-xs text-slate-400 italic">Open list is empty.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {currentStep.open_list.map((item, idx) => (
                    <div
                      key={idx}
                      className={`p-2.5 rounded-lg border text-xs ${
                        idx === 0
                          ? 'bg-blue-50/80 dark:bg-blue-950/50 border-blue-400 dark:border-blue-700 ring-2 ring-blue-500/20'
                          : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between font-bold">
                        <span className="text-slate-800 dark:text-slate-200 truncate">{item.node_id}</span>
                        {idx === 0 && (
                          <span className="text-[9px] bg-blue-600 text-white px-1 rounded uppercase">
                            Next Best
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                        <span>g: {item.g_score}</span>
                        <span className="font-bold text-blue-600 dark:text-blue-400">f: {item.f_score}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Evaluated Neighbors Table */}
            {currentStep.neighbors_evaluated && currentStep.neighbors_evaluated.length > 0 && (
              <div className="glass-panel p-4 space-y-3">
                <h4 className="text-xs font-bold uppercase text-slate-700 dark:text-slate-300">
                  Outgoing Road Evaluation at this step:
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-400 font-bold uppercase text-[10px]">
                        <th className="pb-2">Neighbor Node</th>
                        <th className="pb-2">Edge Distance</th>
                        <th className="pb-2">Calculated g(n)</th>
                        <th className="pb-2">Heuristic h(n)</th>
                        <th className="pb-2">Total f(n)</th>
                        <th className="pb-2">Search Decision</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {currentStep.neighbors_evaluated.map((nbr, i) => (
                        <tr key={i} className="font-medium">
                          <td className="py-2 font-semibold text-slate-800 dark:text-slate-200">
                            {nbr.neighbor_name || nbr.neighbor_id}
                          </td>
                          <td className="py-2">{nbr.edge_distance ? `${nbr.edge_distance} km` : '-'}</td>
                          <td className="py-2 font-mono">{nbr.g_score ?? '-'}</td>
                          <td className="py-2 font-mono">{nbr.h_score ?? '-'}</td>
                          <td className="py-2 font-mono font-bold text-blue-600 dark:text-blue-400">
                            {nbr.f_score ?? '-'}
                          </td>
                          <td className="py-2">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                nbr.status.includes('Added')
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                              }`}
                            >
                              {nbr.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Closed List & Final Solution Summary */}
          <div className="space-y-6">
            {/* Final Solution Summary Card */}
            <div className="glass-panel p-5 space-y-4 border border-blue-200 dark:border-blue-800/60 bg-blue-50/20 dark:bg-blue-950/20">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-500" />
                <h4 className="text-xs font-bold uppercase text-slate-900 dark:text-white">
                  A* Optimal Path Summary
                </h4>
              </div>

              {result.found ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Shortest Path Found</span>
                  </div>

                  <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-medium flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-orange-500" /> Total Distance:
                      </span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {result.total_distance_km} km
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-medium flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-blue-500" /> Est. Travel Time:
                      </span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {result.estimated_travel_time_hours} hrs
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-medium flex items-center gap-1">
                        <Fuel className="w-3.5 h-3.5 text-purple-500" /> Est. Fuel Consumed:
                      </span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {result.estimated_fuel_liters} L
                      </span>
                    </div>
                  </div>

                  {/* Waypoints Sequence */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase">
                      Optimal Waypoints Chain ({result.path.length}):
                    </label>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {result.path_names.map((name, i) => (
                        <React.Fragment key={i}>
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200 font-bold text-[11px] rounded-lg">
                            {name}
                          </span>
                          {i < result.path_names.length - 1 && (
                            <ChevronRight className="w-3 h-3 text-slate-400" />
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl space-y-1 text-xs text-red-700 dark:text-red-300">
                  <div className="flex items-center gap-1.5 font-bold">
                    <AlertCircle className="w-4 h-4" />
                    <span>Path Not Found</span>
                  </div>
                  <p>{result.message}</p>
                </div>
              )}
            </div>

            {/* Closed List (Explored Nodes) */}
            <div className="glass-panel p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase text-slate-700 dark:text-slate-300">
                  Closed List (Visited Nodes)
                </h4>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                  {currentStep.closed_list.length} Explored
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {currentStep.closed_list.map((nodeId, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium border border-slate-200 dark:border-slate-700"
                  >
                    {nodeId}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
