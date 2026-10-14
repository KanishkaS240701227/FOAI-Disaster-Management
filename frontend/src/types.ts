export type Level = 'Low' | 'Elevated' | 'High' | 'Severe';
export type Severity = 'Low' | 'Medium' | 'High' | 'Critical';

export interface Bundle { food: number; water: number; medicine: number; blankets: number; emergency_kits: number }

export interface ZoneProps {
  id: string; number: number | null; name: string; kind: 'gcc' | 'suburb';
  area_km2: number; pop: number; density: number; coastal: boolean; low_lying: number; soil: number;
  wards: [number, number] | null; centroid: [number, number];
}
export interface ZoneScore {
  zone_id: string; overall: number; level: Level; flood: number; wind: number; quake: number;
  rain24: number; rain72: number; gust: number; hotspots: number; severe_hotspots: number; drivers: string[];
}
export interface Hotspot {
  id: string; name: string; lat: number; lng: number; severity: number; radius_m: number; source: string;
  zone: string; ward: number | null; exposed_pop: number;
}
export interface Quake { mag: number; place: string; lat: number; lng: number; depth_km: number; time: number | null; dist_km: number }
export interface HazardInputs {
  mode: 'live' | 'scenario' | 'offline'; label: string; description: string; rain24: number; rain72: number;
  gust_kmh: number; surge_m: number; river_index: number | null; quakes: Quake[]; fetched_at: string | null;
  stale: boolean; sources: Record<string, { ok: boolean; name: string; error?: string }>;
  timeline: { t: string; rain: number; gust: number }[];
}
export interface CitySummary {
  meter: number; level: Level; peak_zone: string; peak_score: number; population_weighted: number;
  zones_high: number; zones_elevated: number; pop_at_risk: number;
}
export interface HazardSnapshot { state: HazardInputs; zones: Record<string, ZoneScore>; summary: CitySummary; scenario_key: string | null; generated_at: string }

export interface Warehouse {
  id: string; name: string; lat: number; lng: number; zone_id: string | null; scale: 'S' | 'M' | 'L'; active: boolean;
  food_stock: number; water_stock: number; medicine_stock: number; blanket_stock: number; emergency_kit_stock: number;
  stocks: Bundle;
}
export interface AffectedArea {
  id: string; name: string; lat: number; lng: number; zone_id: string | null; hotspot_id: string | null;
  hazard: 'flood' | 'wind' | 'earthquake' | 'manual'; risk_score: number; people_affected: number; reason: string;
  manual: boolean; population: number; severity: Severity; demands: Bundle;
}
export interface Truck {
  id: string; truck_number: string; truck_type: string; capacity: number; fuel_capacity: number; average_speed: number;
  fuel_consumption: number; current_warehouse_id: string; warehouse_id: string; status: 'Available' | 'Busy' | 'In Maintenance';
}
export interface NetworkInfo {
  source: 'osm' | 'fallback'; nodes: number; edges: number; state: { open: number; slow: number; blocked: number };
  version: number; fetched_at: string | null;
  import: { state: 'idle' | 'running' | 'done' | 'error'; message: string; progress: number; error: string | null; nodes?: number; edges?: number };
  osm_available?: boolean;
}
export interface ScenarioInfo { key: string; name: string; kind: string; description: string }
export interface AppStats {
  total_warehouses: number; total_affected_locations: number; available_trucks: number; total_trucks: number;
  total_resources_stock: Bundle; total_resources_demand: Bundle;
}
export interface AppState {
  scenario: ScenarioInfo; hazard: HazardSnapshot; warehouses: Warehouse[]; affected_areas: AffectedArea[]; trucks: Truck[];
  network: NetworkInfo; stats: AppStats;
  latest_plan: { id: string; created_at: string; name: string; coverage_pct: number; total_distance_km: number; total_time_hours: number } | null;
}
export interface ScenarioItem { key: string; name: string; short: string; kind: string; description: string }

export interface StopAllocation {
  location_id: string; location_name: string; severity: Severity; delivered: Bundle; unmet: Bundle;
  eta_hours: number; eta_clock: string | null; people_affected: number; zone_id: string | null;
}
export interface Leg {
  from: string; to: string; from_name: string; to_name: string; km: number; hours: number; depart_h: number;
  arrive_h: number; found: boolean; slow_segments: number; i0: number; i1: number;
}
export interface TruckPlan {
  truck_id: string; truck_number: string; warehouse_id: string; warehouse_name: string;
  assigned_locations: string[]; assigned_location_names: string[]; distance_km: number; estimated_time_hours: number;
  fuel_usage_liters: number; total_load_units: number; capacity_limit: number; capacity_utilization_pct: number;
  fuel_capacity_limit: number; overload_units: number; fuel_overuse_liters: number; resources_delivered: Bundle;
  priority_level: Severity; stops_detail: StopAllocation[]; route_lnglat: [number, number][]; legs: Leg[];
  depart_clock: string | null; return_clock: string | null; total_hours: number; road_names: string[];
}
export interface Plan {
  plan_id: string; scenario_name: string; created_at: string; total_distance_km: number; total_fuel_liters: number;
  total_travel_time_hours: number; overall_efficiency_pct: number; coverage_pct: number; total_resources_delivered: number;
  total_demand_units: number; truck_plans: TruckPlan[]; generation_history: { generation: number; best_fitness: number; avg_fitness: number; best_distance_km: number }[];
  unmet_demands: Record<string, Partial<Bundle>>; algorithm_parameters: Record<string, string | number>; warnings: string[]; message: string;
  generated_at: string | null; network_source: string | null; blocked_roads: number; slow_roads: number; areas_total: number;
  areas_planned: number; compute_seconds: number; a_star_searches: number;
  depot_usage: Record<string, Partial<Bundle>>; first_eta: Record<string, number>; plan_start: string | null;
  makespan_hours: number; people_served: number;
}
export interface PlanSummary { id: string; name: string; created_at: string; coverage_pct: number; total_distance_km: number; total_time_hours: number }
export interface AStarResult {
  found: boolean; start_name: string; goal_name: string; path_lnglat: [number, number][]; total_distance_km: number;
  estimated_travel_time_hours: number; nodes_explored_count: number; trace: number[][]; trace_truncated: boolean;
  start: [number, number]; goal: [number, number]; vmax_kmh: number; message: string;
}
export interface EdgeProbe {
  found: boolean; id?: number; name?: string; cls?: string; km?: number; status?: 'open' | 'slow' | 'blocked';
  factor?: number; reason?: string; manual?: boolean; distance_m?: number; geometry?: [number, number][];
}
export type FC = GeoJSON.FeatureCollection<GeoJSON.Geometry, Record<string, unknown>>;

export type Selection =
  | { kind: 'zone'; id: string }
  | { kind: 'depot'; id: string }
  | { kind: 'area'; id: string }
  | { kind: 'road'; probe: EdgeProbe };

export interface LayerToggles { risk: boolean; floods: boolean; depots: boolean; needs: boolean; roads: boolean }
