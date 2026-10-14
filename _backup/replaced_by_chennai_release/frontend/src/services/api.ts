import axios from 'axios';
import {
  Warehouse,
  AffectedArea,
  Road,
  Truck,
  DashboardStats,
  DistributionPlanResponse,
  AStarVisualizerResponse,
  ScenarioPreset,
} from '../types';

const API_BASE = '/api';

export const api = {
  // Health & Stats
  getHealth: () => axios.get(`${API_BASE}/health`).then((r) => r.data),
  getDashboardStats: (): Promise<DashboardStats> =>
    axios.get(`${API_BASE}/dashboard/stats`).then((r) => r.data),

  // Scenarios
  getScenarios: (): Promise<ScenarioPreset[]> =>
    axios.get(`${API_BASE}/scenarios`).then((r) => r.data),
  loadScenario: (key: string) =>
    axios.post(`${API_BASE}/scenarios/load/${key}`).then((r) => r.data),

  // Warehouses
  getWarehouses: (): Promise<Warehouse[]> =>
    axios.get(`${API_BASE}/warehouses`).then((r) => r.data),
  createWarehouse: (data: Partial<Warehouse>): Promise<Warehouse> =>
    axios.post(`${API_BASE}/warehouses`, data).then((r) => r.data),
  updateWarehouse: (id: string, data: Partial<Warehouse>): Promise<Warehouse> =>
    axios.put(`${API_BASE}/warehouses/${id}`, data).then((r) => r.data),
  deleteWarehouse: (id: string) =>
    axios.delete(`${API_BASE}/warehouses/${id}`).then((r) => r.data),

  // Affected Areas
  getAffectedAreas: (): Promise<AffectedArea[]> =>
    axios.get(`${API_BASE}/affected-areas`).then((r) => r.data),
  createAffectedArea: (data: Partial<AffectedArea>): Promise<AffectedArea> =>
    axios.post(`${API_BASE}/affected-areas`, data).then((r) => r.data),
  updateAffectedArea: (id: string, data: Partial<AffectedArea>): Promise<AffectedArea> =>
    axios.put(`${API_BASE}/affected-areas/${id}`, data).then((r) => r.data),
  deleteAffectedArea: (id: string) =>
    axios.delete(`${API_BASE}/affected-areas/${id}`).then((r) => r.data),

  // Roads
  getRoads: (): Promise<Road[]> =>
    axios.get(`${API_BASE}/roads`).then((r) => r.data),
  createRoad: (data: Partial<Road>): Promise<Road> =>
    axios.post(`${API_BASE}/roads`, data).then((r) => r.data),
  updateRoad: (id: string, data: Partial<Road>): Promise<Road> =>
    axios.put(`${API_BASE}/roads/${id}`, data).then((r) => r.data),
  deleteRoad: (id: string) =>
    axios.delete(`${API_BASE}/roads/${id}`).then((r) => r.data),

  // Trucks
  getTrucks: (): Promise<Truck[]> =>
    axios.get(`${API_BASE}/trucks`).then((r) => r.data),
  createTruck: (data: Partial<Truck>): Promise<Truck> =>
    axios.post(`${API_BASE}/trucks`, data).then((r) => r.data),
  updateTruck: (id: string, data: Partial<Truck>): Promise<Truck> =>
    axios.put(`${API_BASE}/trucks/${id}`, data).then((r) => r.data),
  deleteTruck: (id: string) =>
    axios.delete(`${API_BASE}/trucks/${id}`).then((r) => r.data),

  // Distribution Planner (A* & GA)
  generatePlan: (params: {
    population_size?: number;
    generations?: number;
    mutation_rate?: number;
    crossover_rate?: number;
    scenario_name?: string;
  }): Promise<DistributionPlanResponse> =>
    axios.post(`${API_BASE}/plan/generate`, params).then((r) => r.data),
  getLatestPlan: () => axios.get(`${API_BASE}/plan/latest`).then((r) => r.data),

  // A* Visualizer
  visualizeAStar: (params: {
    start_id: string;
    goal_id: string;
    truck_speed_kmh?: number;
    truck_fuel_rate_lpkm?: number;
  }): Promise<AStarVisualizerResponse> =>
    axios.post(`${API_BASE}/visualize/astar`, params).then((r) => r.data),

  // Reports
  downloadPdfReportUrl: (planId?: string) =>
    planId ? `${API_BASE}/reports/pdf/${planId}` : `${API_BASE}/reports/pdf/latest/download`,
};
