export type SeverityLevel = 'Low' | 'Medium' | 'High' | 'Critical';
export type RoadCondition = 'Paved' | 'Unpaved' | 'Damaged';
export type RoadStatus = 'Open' | 'Blocked' | 'Under Repair';
export type TruckStatus = 'Available' | 'Busy' | 'In Maintenance';

export interface ResourceBundle {
  food: number;
  water: number;
  medicine: number;
  blankets: number;
  emergency_kits: number;
}

export interface Warehouse {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  lat?: number;
  lng?: number;
  food_stock: number;
  water_stock: number;
  medicine_stock: number;
  blanket_stock: number;
  emergency_kit_stock: number;
  stocks?: ResourceBundle;
  created_at?: string;
  updated_at?: string;
}

export interface AffectedArea {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  lat?: number;
  lng?: number;
  population: number;
  severity: SeverityLevel;
  food_demand: number;
  water_demand: number;
  medicine_demand: number;
  blanket_demand: number;
  emergency_kit_demand: number;
  demands?: ResourceBundle;
  created_at?: string;
  updated_at?: string;
}

export interface Road {
  id: string;
  source_id: string;
  destination_id: string;
  distance: number;
  travel_time: number;
  road_condition: RoadCondition;
  road_status: RoadStatus;
  condition?: RoadCondition;
  status?: RoadStatus;
  one_way?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Truck {
  id: string;
  truck_number: string;
  capacity: number;
  fuel_capacity: number;
  average_speed: number;
  fuel_consumption: number;
  current_warehouse_id: string;
  warehouse_id?: string;
  status: TruckStatus;
  created_at?: string;
  updated_at?: string;
}

export interface StopAllocation {
  location_id: string;
  location_name: string;
  severity: SeverityLevel;
  delivered: ResourceBundle;
  unmet: ResourceBundle;
}

export interface TruckPlanOutput {
  truck_id: string;
  truck_number: string;
  warehouse_id: string;
  warehouse_name: string;
  assigned_locations: string[];
  assigned_location_names: string[];
  optimal_route_sequence: string[];
  optimal_route_coordinates: [number, number][];
  distance_km: number;
  estimated_time_hours: number;
  fuel_usage_liters: number;
  total_load_units: number;
  capacity_limit: number;
  capacity_utilization_pct: number;
  fuel_capacity_limit: number;
  overload_units: number;
  fuel_overuse_liters: number;
  resources_delivered: ResourceBundle;
  priority_level: SeverityLevel;
  stops_detail: StopAllocation[];
}

export interface GenerationHistoryMetric {
  generation: number;
  best_fitness: number;
  avg_fitness: number;
  worst_fitness: number;
  best_distance_km: number;
  best_coverage_pct: number;
}

export interface DistributionPlanResponse {
  plan_id: string;
  scenario_name: string;
  created_at: string;
  total_distance_km: number;
  total_fuel_liters: number;
  total_travel_time_hours: number;
  overall_efficiency_pct: number;
  coverage_pct: number;
  total_resources_delivered: number;
  total_demand_units: number;
  truck_plans: TruckPlanOutput[];
  generation_history: GenerationHistoryMetric[];
  unmet_demands: Record<string, Record<string, number>>;
  algorithm_parameters: Record<string, any>;
  warnings: string[];
  message: string;
}

export interface DashboardStats {
  total_warehouses: number;
  total_affected_locations: number;
  available_trucks: number;
  busy_trucks: number;
  total_trucks: number;
  pending_requests_count: number;
  total_resources_stock: ResourceBundle;
  total_resources_demand: ResourceBundle;
  total_travel_distance_km: number;
  estimated_fuel_usage_liters: number;
  overall_delivery_efficiency_pct: number;
  coverage_percentage: number;
}

export interface AStarStep {
  step_num: number;
  current_node: string;
  current_f: number;
  current_g: number;
  current_h: number;
  open_list: Array<{
    node_id: string;
    f_score: number;
    g_score: number;
    parent_id?: string;
  }>;
  closed_list: string[];
  neighbors_evaluated: Array<Record<string, any>>;
  action_description: string;
}

export interface AStarVisualizerResponse {
  found: boolean;
  path: string[];
  path_names: string[];
  path_coordinates: [number, number][];
  total_distance_km: number;
  estimated_travel_time_hours: number;
  estimated_fuel_liters: number;
  nodes_explored_count: number;
  open_list_final_size: number;
  steps_log: AStarStep[];
  message: string;
}

export interface ScenarioPreset {
  key: string;
  name: string;
  description: string;
  warehouses_count: number;
  affected_areas_count: number;
  roads_count: number;
  trucks_count: number;
}
