import type { AffectedArea, Bundle, Plan, Severity, TruckPlan } from '../types';
import { RES_KEYS } from './format';
import { pathLengths, pointAlong, type LngLat } from './geo';

export interface RouteIndex { truck: TruckPlan; path: LngLat[]; cum: number[] }

export function indexPlan(plan: Plan | null): RouteIndex[] {
  if (!plan) return [];
  return plan.truck_plans
    .filter((t) => t.route_lnglat.length > 1)
    .map((t) => {
      const path = t.route_lnglat as LngLat[];
      return { truck: t, path, cum: pathLengths(path).cum };
    });
}

/** Where a truck is `t` hours after dispatch, or null once it is back at the depot. */
export function truckPosition(r: RouteIndex, t: number): LngLat | null {
  const legs = r.truck.legs;
  if (!legs.length) return null;
  if (t <= legs[0].depart_h) return r.path[0];
  for (let i = 0; i < legs.length; i++) {
    const L = legs[i];
    if (t >= L.depart_h && t <= L.arrive_h) {
      const span = L.arrive_h - L.depart_h;
      return pointAlong(r.path, r.cum, Math.min(L.i0, r.path.length - 1), Math.min(L.i1, r.path.length - 1), span > 0 ? (t - L.depart_h) / span : 1);
    }
    const next = legs[i + 1];
    if (next && t > L.arrive_h && t < next.depart_h) return r.path[Math.min(L.i1, r.path.length - 1)];
  }
  return null;
}

export function addHours(iso: string | null | undefined, hours: number): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getTime() + hours * 3600_000).toISOString();
}

export const SEVERITY_ORDER: Severity[] = ['Critical', 'High', 'Medium', 'Low'];

export interface PlanDigest {
  /** Areas that get at least one delivery, and how many were flagged in all. */
  areasServed: number;
  areasTotal: number;
  trucks: number;
  depots: number;
  /** The very first delivery anywhere. */
  first: { hours: number; name: string } | null;
  /** How the most severe areas fare: how many are reached and when the last of them is. */
  critical: { total: number; served: number; byHours: number } | null;
  lastHours: number;
  peopleReached: number;
  peopleAffected: number;
  /** What the depots and fleet could not cover, per item, and the share of what was asked for. */
  shortfall: Bundle;
  shortfallUnits: number;
  short: boolean;
}

/** Plain-language facts about a plan, worked out from the plan and the flagged areas. */
export function digestPlan(plan: Plan, areas: AffectedArea[]): PlanDigest {
  const firstEta = new Map<string, { h: number; name: string; sev: Severity }>();
  const depots = new Set<string>();
  for (const t of plan.truck_plans) {
    depots.add(t.warehouse_id);
    for (const s of t.stops_detail) {
      const cur = firstEta.get(s.location_id);
      if (!cur || s.eta_hours < cur.h) firstEta.set(s.location_id, { h: s.eta_hours, name: s.location_name, sev: s.severity });
    }
  }
  const stops = [...firstEta.values()];
  const first = stops.length ? stops.reduce((a, b) => (b.h < a.h ? b : a)) : null;

  const critAreas = areas.filter((a) => a.severity === 'Critical');
  const critServed = stops.filter((x) => x.sev === 'Critical');
  const critical = critAreas.length
    ? { total: critAreas.length, served: critServed.length, byHours: critServed.reduce((m, x) => Math.max(m, x.h), 0) }
    : null;

  const shortfall: Bundle = { food: 0, water: 0, medicine: 0, blankets: 0, emergency_kits: 0 };
  for (const u of Object.values(plan.unmet_demands ?? {})) for (const k of RES_KEYS) shortfall[k] += u[k] ?? 0;
  const shortfallUnits = RES_KEYS.reduce((n, k) => n + shortfall[k], 0);

  return {
    areasServed: firstEta.size,
    areasTotal: Math.max(plan.areas_total ?? 0, firstEta.size),
    trucks: plan.truck_plans.length,
    depots: depots.size,
    first: first ? { hours: first.h, name: first.name } : null,
    critical,
    lastHours: plan.makespan_hours ?? plan.total_travel_time_hours,
    peopleReached: plan.people_served ?? 0,
    peopleAffected: areas.reduce((n, a) => n + a.people_affected, 0),
    shortfall,
    shortfallUnits,
    short: plan.coverage_pct < 98,
  };
}
