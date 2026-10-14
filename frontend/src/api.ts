import type { AppState, AStarResult, EdgeProbe, FC, Hotspot, Plan, PlanSummary, ScenarioItem, HazardSnapshot } from './types';

const BASE = '/api';

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, { headers: { 'Content-Type': 'application/json' }, ...init });
  if (!res.ok) {
    let msg = res.statusText;
    try { const j = await res.json(); msg = typeof j.detail === 'string' ? j.detail : JSON.stringify(j.detail); } catch { /* ignore */ }
    throw new Error(msg || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}
const post = <T,>(p: string, body?: unknown) => req<T>(p, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });
const put = <T,>(p: string, body: unknown) => req<T>(p, { method: 'PUT', body: JSON.stringify(body) });
const del = <T,>(p: string) => req<T>(p, { method: 'DELETE' });

export const api = {
  state: () => req<AppState>('/state'),
  zones: () => req<FC>('/geo/zones'),
  outline: () => req<GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>>('/geo/outline'),
  meta: () => req<{ bounds: [[number, number], [number, number]]; center: [number, number]; total_area_km2: number; total_population: number }>('/geo/meta'),
  hotspots: () => req<Hotspot[]>('/geo/hotspots'),
  scenarios: () => req<{ active: string; items: ScenarioItem[] }>('/scenarios'),
  loadScenario: (key: string) => post<{ success: boolean }>(`/scenarios/load/${key}`),
  refreshHazards: () => post<HazardSnapshot>('/hazards/refresh'),
  syncAreas: () => post<{ count: number }>('/affected-areas/sync'),
  generatePlan: (body: { generations?: number; population_size?: number; max_areas?: number }) => post<Plan>('/plan/generate', body),
  latestPlan: () => req<Plan & { id: string; created_at: string }>('/plan/latest'),
  plans: () => req<PlanSummary[]>('/plans'),
  plan: (id: string) => req<Plan>(`/plans/${id}`),
  astar: (start_id: string, goal_id: string) => post<AStarResult>('/visualize/astar', { start_id, goal_id }),
  overlay: () => req<FC>('/network/overlay'),
  probeRoad: (lat: number, lng: number) => req<EdgeProbe>(`/network/nearest-edge?lat=${lat}&lng=${lng}`),
  blockRoad: (id: number, reason?: string) => post(`/network/edges/${id}/block`, { reason: reason || 'Blocked by operator' }),
  unblockRoad: (id: number) => post(`/network/edges/${id}/unblock`),
  downloadRoads: () => post<{ started: boolean }>('/network/download'),
  createWarehouse: (b: Record<string, unknown>) => post('/warehouses', b),
  updateWarehouse: (id: string, b: Record<string, unknown>) => put(`/warehouses/${id}`, b),
  deleteWarehouse: (id: string) => del(`/warehouses/${id}`),
  createArea: (b: Record<string, unknown>) => post('/affected-areas', b),
  updateArea: (id: string, b: Record<string, unknown>) => put(`/affected-areas/${id}`, b),
  deleteArea: (id: string) => del(`/affected-areas/${id}`),
  createTruck: (b: Record<string, unknown>) => post('/trucks', b),
  updateTruck: (id: string, b: Record<string, unknown>) => put(`/trucks/${id}`, b),
  deleteTruck: (id: string) => del(`/trucks/${id}`),
  pdfUrl: (id?: string) => (id ? `${BASE}/reports/pdf/${id}` : `${BASE}/reports/pdf/latest/download`),
};
