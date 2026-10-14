export type LngLat = [number, number];

const R = 6371008.8;
const rad = (d: number) => (d * Math.PI) / 180;

export function haversineKm(a: LngLat, b: LngLat): number {
  const dLat = rad(b[1] - a[1]);
  const dLng = rad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLng / 2) ** 2;
  return (2 * R * Math.asin(Math.sqrt(h))) / 1000;
}

/** Regular polygon approximating a circle of radius `r` metres around a point. */
export function circlePolygon(lng: number, lat: number, r: number, steps = 48): GeoJSON.Polygon {
  const ring: LngLat[] = [];
  const dLat = (r / R) * (180 / Math.PI);
  const dLng = dLat / Math.cos(rad(lat));
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    ring.push([lng + dLng * Math.cos(a), lat + dLat * Math.sin(a)]);
  }
  return { type: 'Polygon', coordinates: [ring] };
}

/** Small square footprint (metres) used for the depot towers. */
export function squarePolygon(lng: number, lat: number, half: number): GeoJSON.Polygon {
  const dLat = (half / R) * (180 / Math.PI);
  const dLng = dLat / Math.cos(rad(lat));
  return {
    type: 'Polygon',
    coordinates: [[[lng - dLng, lat - dLat], [lng + dLng, lat - dLat], [lng + dLng, lat + dLat], [lng - dLng, lat + dLat], [lng - dLng, lat - dLat]]],
  };
}

export function pointInRing(p: LngLat, ring: LngLat[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function polygonRings(g: GeoJSON.Geometry | null | undefined): LngLat[][] {
  if (!g) return [];
  if (g.type === 'Polygon') return g.coordinates as LngLat[][];
  if (g.type === 'MultiPolygon') return (g.coordinates as LngLat[][][]).flat();
  return [];
}

export function pointInGeometry(p: LngLat, g: GeoJSON.Geometry): boolean {
  if (g.type === 'Polygon') {
    const [outer, ...holes] = g.coordinates as LngLat[][];
    return pointInRing(p, outer) && !holes.some((h) => pointInRing(p, h));
  }
  if (g.type === 'MultiPolygon') return (g.coordinates as LngLat[][][]).some((poly) => pointInGeometry(p, { type: 'Polygon', coordinates: poly }));
  return false;
}

export function pathLengths(path: LngLat[]): { cum: number[]; total: number } {
  const cum = [0];
  for (let i = 1; i < path.length; i++) cum.push(cum[i - 1] + haversineKm(path[i - 1], path[i]));
  return { cum, total: cum[cum.length - 1] };
}

/** Point at fraction f (0..1) along path indices i0..i1 (inclusive). */
export function pointAlong(path: LngLat[], cum: number[], i0: number, i1: number, f: number): LngLat {
  const a = cum[i0];
  const b = cum[i1];
  const target = a + (b - a) * Math.min(1, Math.max(0, f));
  let lo = i0;
  let hi = i1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= target) lo = mid;
    else hi = mid;
  }
  const span = cum[hi] - cum[lo];
  const t = span > 0 ? (target - cum[lo]) / span : 0;
  return [path[lo][0] + (path[hi][0] - path[lo][0]) * t, path[lo][1] + (path[hi][1] - path[lo][1]) * t];
}

export function bboxOf(coords: LngLat[]): [LngLat, LngLat] {
  let minX = 180, minY = 90, maxX = -180, maxY = -90;
  for (const [x, y] of coords) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return [[minX, minY], [maxX, maxY]];
}

export function geometryBBox(g: GeoJSON.Geometry): [LngLat, LngLat] {
  return bboxOf(polygonRings(g).flat());
}
