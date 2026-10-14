import type { AffectedArea, AppState, FC, Hotspot, Selection, Warehouse } from '../types';
import { circlePolygon, type LngLat } from '../lib/geo';
import { LEVEL_COLOR, SEV_COLOR } from './style';

type Feat = GeoJSON.Feature<GeoJSON.Geometry, Record<string, unknown>>;
const fc = (features: Feat[]): GeoJSON.FeatureCollection<GeoJSON.Geometry, Record<string, unknown>> => ({ type: 'FeatureCollection', features });

export function zonesData(zones: FC, state: AppState | null) {
  const scores = state?.hazard.zones ?? {};
  const maxDensity = Math.max(...zones.features.map((f) => Number(f.properties.density) || 0), 1);
  return fc(zones.features.map((f) => {
    const id = String(f.properties.id);
    const sc = scores[id];
    const density = Number(f.properties.density) || 0;
    return {
      type: 'Feature', id, geometry: f.geometry,
      properties: {
        id, name: f.properties.name, pop: f.properties.pop, density, risk: sc?.overall ?? 0, level: sc?.level ?? 'Low',
        h: 350 + Math.pow(density / maxDensity, 0.8) * 2300,
      },
    } as Feat;
  }));
}

export function zoneLabelsData(zones: FC) {
  return fc(zones.features.map((f) => {
    const c = f.properties.centroid as [number, number];
    return { type: 'Feature', geometry: { type: 'Point', coordinates: [c[1], c[0]] }, properties: { name: f.properties.name, pop: f.properties.pop } } as Feat;
  }));
}

export function floodsData(areas: AffectedArea[], hotspots: Hotspot[]) {
  const hs = new Map(hotspots.map((h) => [h.id, h]));
  const out: Feat[] = [];
  for (const a of areas) {
    if (a.hazard !== 'flood' || !a.hotspot_id) continue;
    const h = hs.get(a.hotspot_id);
    const base = h?.radius_m ?? 700;
    const r = base * (0.55 + (a.risk_score / 100) * 0.95);
    out.push({ type: 'Feature', geometry: circlePolygon(a.lng, a.lat, r), properties: { id: a.id, intensity: a.risk_score, name: a.name } });
  }
  return fc(out);
}

export function depotsData(depots: Warehouse[]) {
  return fc(depots.map((d) => ({
    type: 'Feature', id: d.id, geometry: { type: 'Point', coordinates: [d.lng, d.lat] },
    properties: { id: d.id, name: d.name, short: d.name.replace(/\s*[-–]\s*.*$/, ''), scale: d.scale, active: d.active },
  } as Feat)));
}

export function needsData(areas: AffectedArea[]) {
  return fc(areas.map((a) => ({
    type: 'Feature', id: a.id, geometry: { type: 'Point', coordinates: [a.lng, a.lat] },
    properties: { id: a.id, name: a.name, severity: a.severity, color: SEV_COLOR[a.severity], r: Math.min(6, Math.max(1, Math.sqrt(a.people_affected) / 14)) },
  } as Feat)));
}

/** One column per area needing relief; height follows the number of people affected, width follows severity. */
export function needs3dData(areas: AffectedArea[]) {
  const width = { Low: 330, Medium: 380, High: 440, Critical: 520 } as const;
  return fc(areas.map((a) => ({
    type: 'Feature', geometry: circlePolygon(a.lng, a.lat, width[a.severity] ?? 400, 20),
    properties: { id: a.id, color: SEV_COLOR[a.severity], h: 650 + Math.min(2800, a.people_affected * 0.75) },
  } as Feat)));
}

export function selectionData(sel: Selection | null, depots: Warehouse[], areas: AffectedArea[]) {
  const ring: Feat[] = [];
  const line: Feat[] = [];
  if (sel?.kind === 'depot') {
    const d = depots.find((x) => x.id === sel.id);
    if (d) ring.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [d.lng, d.lat] }, properties: {} });
  } else if (sel?.kind === 'area') {
    const a = areas.find((x) => x.id === sel.id);
    if (a) ring.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [a.lng, a.lat] }, properties: {} });
  } else if (sel?.kind === 'road' && sel.probe.geometry) {
    line.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: sel.probe.geometry as LngLat[] }, properties: {} });
  }
  return { ring: fc(ring), line: fc(line) };
}

export { LEVEL_COLOR };
