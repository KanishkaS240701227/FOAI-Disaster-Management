import type { Map as MLMap } from 'maplibre-gl';
import { PALETTE, SEV_COLOR, type Theme } from './style';
import type { LngLat } from '../lib/geo';

export interface RouteDraw { id: string; path: LngLat[]; selected: boolean; dim: boolean }
export interface TruckDraw { id: string; label: string; pos: LngLat; selected: boolean }
export interface DepotDraw { id: string; pos: LngLat; scale: 'S' | 'M' | 'L'; active: boolean; selected: boolean }
export interface StopDraw { pos: LngLat; n: number; severity: keyof typeof SEV_COLOR; label: string }
export interface ExplainDraw {
  trace: number[][]; upto: number; path: LngLat[]; start: LngLat; goal: LngLat; done: boolean; fMin: number; fMax: number;
}
export interface Scene {
  rings: LngLat[][];
  theme: Theme;
  routes: RouteDraw[];
  trucks: TruckDraw[];
  stops: StopDraw[];
  depots: DepotDraw[];
  explain: ExplainDraw | null;
}

export const EMPTY_SCENE: Scene = { rings: [], theme: 'light', routes: [], trucks: [], stops: [], depots: [], explain: null };

// ---- perspective-safe projection --------------------------------------------------------------
// map.project() divides by w without checking its sign, so with a tilted camera any point behind the
// camera lands mirrored on screen. We project through the same matrix but clip against a near plane.
interface Hom { X: number; Y: number; W: number }

export interface Projector {
  point(c: LngLat): { x: number; y: number } | null;
  hom(c: LngLat): Hom;
  wMin: number;
}

export function makeProjector(map: MLMap): Projector {
  const tr = (map as unknown as { transform: { pixelMatrix?: ArrayLike<number>; worldSize?: number; cameraToCenterDistance?: number } }).transform;
  const m = tr.pixelMatrix;
  const ws = tr.worldSize;
  const wMin = 0.12 * (tr.cameraToCenterDistance ?? 800);
  if (!m || !ws) {
    // unknown internals: fall back to the public API
    return {
      wMin: 0,
      point: (c) => { const p = map.project(c); return { x: p.x, y: p.y }; },
      hom: (c) => { const p = map.project(c); return { X: p.x, Y: p.y, W: 1 }; },
    };
  }
  const hom = (c: LngLat): Hom => {
    const mx = ((c[0] + 180) / 360) * ws;
    const sin = Math.sin((c[1] * Math.PI) / 180);
    const my = (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * ws;
    return {
      X: m[0] * mx + m[4] * my + m[12],
      Y: m[1] * mx + m[5] * my + m[13],
      W: m[3] * mx + m[7] * my + m[15],
    };
  };
  return {
    wMin,
    hom,
    point(c) {
      const h = hom(c);
      if (h.W < 1) return null;
      return { x: h.X / h.W, y: h.Y / h.W };
    },
  };
}

function lerpHom(a: Hom, b: Hom, wMin: number): Hom {
  const t = (wMin - a.W) / (b.W - a.W);
  return { X: a.X + t * (b.X - a.X), Y: a.Y + t * (b.Y - a.Y), W: wMin };
}

function ringPath(pj: Projector, rings: LngLat[][], dy = 0): Path2D {
  const path = new Path2D();
  for (const ring of rings) {
    const hs = ring.map(pj.hom);
    const out: Hom[] = [];
    for (let i = 0; i < hs.length; i++) {
      const a = hs[i];
      const b = hs[(i + 1) % hs.length];
      const ain = a.W >= pj.wMin;
      const bin = b.W >= pj.wMin;
      if (ain) out.push(a);
      if (ain !== bin) out.push(lerpHom(a, b, pj.wMin));
    }
    if (out.length < 3) continue;
    out.forEach((h, i) => {
      const x = h.X / h.W;
      const y = h.Y / h.W + dy;
      if (i === 0) path.moveTo(x, y);
      else path.lineTo(x, y);
    });
    path.closePath();
  }
  return path;
}

function polyline(pj: Projector, line: LngLat[]): Path2D {
  const path = new Path2D();
  const hs = line.map(pj.hom);
  let pen = false;
  for (let i = 0; i < hs.length - 1; i++) {
    let a = hs[i];
    let b = hs[i + 1];
    const ain = a.W >= pj.wMin;
    const bin = b.W >= pj.wMin;
    if (!ain && !bin) { pen = false; continue; }
    if (!ain) { a = lerpHom(a, b, pj.wMin); pen = false; }
    if (!bin) b = lerpHom(a, b, pj.wMin);
    if (!pen) path.moveTo(a.X / a.W, a.Y / a.W);
    path.lineTo(b.X / b.W, b.Y / b.W);
    pen = bin;
  }
  return path;
}

function fColor(t: number, theme: Theme): string {
  // cool -> warm ramp: cheap nodes pale blue, expensive nodes deep indigo
  const a = theme === 'light' ? [168, 205, 232] : [90, 140, 190];
  const b = theme === 'light' ? [40, 74, 150] : [190, 210, 250];
  const k = Math.min(1, Math.max(0, t));
  return `rgb(${Math.round(a[0] + (b[0] - a[0]) * k)},${Math.round(a[1] + (b[1] - a[1]) * k)},${Math.round(a[2] + (b[2] - a[2]) * k)})`;
}

const DEPOT_STEM = { S: 14, M: 20, L: 28 } as const;
const DEPOT_HEAD = { S: 18, M: 21, L: 25 } as const;

/** Pin geometry in pixels. Pins shrink when zoomed out so 23 depots stay legible over the whole city. */
export function depotMetrics(scale: 'S' | 'M' | 'L', zoom: number): { stem: number; size: number; k: number } {
  const k = Math.min(1, Math.max(0.52, 0.52 + (zoom - 9.4) * 0.19));
  return { stem: DEPOT_STEM[scale] * k, size: DEPOT_HEAD[scale] * k, k };
}

export function drawScene(ctx: CanvasRenderingContext2D, map: MLMap, scene: Scene, w: number, h: number) {
  ctx.clearRect(0, 0, w, h);
  const P = PALETTE[scene.theme];
  const pj = makeProjector(map);
  const zoom = map.getZoom();
  const pitch = (map.getPitch() * Math.PI) / 180;

  // ---- 1. hide everything outside the Chennai outline, then give the model a slab to sit on
  if (scene.rings.length) {
    const outside = new Path2D();
    outside.rect(-4, -4, w + 8, h + 8);
    outside.addPath(ringPath(pj, scene.rings));

    ctx.fillStyle = P.board;
    ctx.fill(outside, 'evenodd');

    const slab = Math.min(12, Math.max(3, (zoom - 8.5) * 1.6)) * Math.sin(pitch);
    ctx.save();
    ctx.clip(outside, 'evenodd');
    ctx.shadowColor = P.shadow;
    ctx.shadowBlur = 26;
    ctx.shadowOffsetY = 12 + slab;
    ctx.fillStyle = P.slabB;
    ctx.fill(ringPath(pj, scene.rings, slab));
    ctx.shadowColor = 'transparent';
    if (slab > 0.6) {
      const steps = Math.ceil(slab);
      for (let i = steps; i >= 1; i--) {
        ctx.fillStyle = i > steps * 0.55 ? P.slabB : P.slabA;
        ctx.fill(ringPath(pj, scene.rings, i));
      }
    }
    ctx.restore();

    ctx.save();
    ctx.lineJoin = 'round';
    ctx.strokeStyle = P.line;
    ctx.lineWidth = 1.25;
    ctx.stroke(ringPath(pj, scene.rings));
    ctx.restore();
  }

  // ---- depot pins: a stem and a head, so depots stand up from the model like small towers
  for (const d of scene.depots) {
    const g = pj.point(d.pos);
    if (!g) continue;
    const { stem, size, k: pk } = depotMetrics(d.scale, zoom);
    const fill = d.selected ? P.accent : d.active ? P.depot : P.line;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.ellipse(g.x, g.y, 6 * pk, 2.6 * pk, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = fill;
    ctx.lineWidth = 1.2 + 0.8 * pk;
    ctx.beginPath();
    ctx.moveTo(g.x, g.y);
    ctx.lineTo(g.x, g.y - stem);
    ctx.stroke();
    const hx = g.x - size / 2;
    const hy = g.y - stem - size;
    roundRect(ctx, hx - 1.5, hy - 1.5, size + 3, size + 3, 6 * pk + 1);
    ctx.fillStyle = scene.theme === 'light' ? '#ffffff' : '#0e161c';
    ctx.fill();
    roundRect(ctx, hx, hy, size, size, 5 * pk + 0.5);
    ctx.fillStyle = fill;
    ctx.fill();
    // warehouse glyph: roof and door
    ctx.strokeStyle = scene.theme === 'light' ? '#ffffff' : '#0e161c';
    ctx.fillStyle = ctx.strokeStyle;
    ctx.lineWidth = 1.6;
    ctx.lineJoin = 'round';
    const cx = g.x;
    const cy = hy + size / 2;
    const k = size / 20;
    ctx.beginPath();
    ctx.moveTo(cx - 6.5 * k, cy - 0.5 * k);
    ctx.lineTo(cx, cy - 6 * k);
    ctx.lineTo(cx + 6.5 * k, cy - 0.5 * k);
    ctx.stroke();
    ctx.fillRect(cx - 4.5 * k, cy - 0.5 * k, 9 * k, 6 * k);
    ctx.restore();
  }

  // ---- 2. A* explanation
  const ex = scene.explain;
  if (ex) {
    const n = Math.min(ex.upto, ex.trace.length);
    const span = Math.max(ex.fMax - ex.fMin, 1e-6);
    ctx.save();
    for (let i = 0; i < n; i++) {
      const r = ex.trace[i];
      const p = pj.point([r[1], r[0]]);
      if (!p) continue;
      const f = (r[2] + r[3] - ex.fMin) / span;
      ctx.fillStyle = fColor(f, scene.theme);
      ctx.globalAlpha = i > n - 14 ? 1 : 0.8;
      ctx.beginPath();
      ctx.arc(p.x, p.y, i > n - 14 ? 4.4 : 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
    if (n > 0 && !ex.done) {
      const r = ex.trace[n - 1];
      const p = pj.point([r[1], r[0]]);
      if (p) {
      ctx.globalAlpha = 1;
      ctx.strokeStyle = P.accent;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
      ctx.stroke();
      }
    }
    ctx.restore();
    if (ex.done && ex.path.length > 1) strokePath(ctx, pj, ex.path, P.accent, 5.5, 1, scene.theme === 'light' ? '#ffffff' : '#0e161c');
    endpoint(ctx, pj, ex.start, P.accent, 'A');
    endpoint(ctx, pj, ex.goal, '#c4303a', 'B');
  }

  // ---- 3. routes
  const anySelected = scene.routes.some((r) => r.selected);
  for (const r of scene.routes) {
    if (r.path.length < 2) continue;
    if (r.selected) continue;
    strokePath(ctx, pj, r.path, P.accent, anySelected ? 1.8 : 2.1, anySelected ? 0.24 : 0.55, scene.theme === 'light' ? 'rgba(255,255,255,0.75)' : 'rgba(14,22,28,0.7)');
  }
  for (const r of scene.routes) {
    if (r.selected && r.path.length > 1) strokePath(ctx, pj, r.path, P.accent, 5.5, 1, scene.theme === 'light' ? '#ffffff' : '#0e161c');
  }

  // ---- 4. stops of the selected route
  ctx.save();
  ctx.font = '600 11px "Public Sans Variable", system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  for (const s of scene.stops) {
    const p = pj.point(s.pos);
    if (!p) continue;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 11, 0, Math.PI * 2);
    ctx.fillStyle = SEV_COLOR[s.severity];
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = scene.theme === 'light' ? '#ffffff' : '#0e161c';
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(String(s.n), p.x, p.y + 0.5);
    if (s.label) {
      const tw = ctx.measureText(s.label).width;
      const bx = p.x + 16;
      ctx.fillStyle = scene.theme === 'light' ? 'rgba(255,255,255,0.94)' : 'rgba(21,32,41,0.94)';
      roundRect(ctx, bx, p.y - 10, tw + 12, 20, 5);
      ctx.fill();
      ctx.fillStyle = P.ink;
      ctx.textAlign = 'left';
      ctx.fillText(s.label, bx + 6, p.y + 0.5);
    }
  }
  ctx.restore();

  // ---- 5. trucks
  ctx.save();
  ctx.font = '650 11px "Public Sans Variable", system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  for (const t of scene.trucks) {
    const p = pj.point(t.pos);
    if (!p) continue;
    const rad = t.selected ? 8.5 : 6;
    ctx.beginPath();
    ctx.arc(p.x, p.y, rad + 2.5, 0, Math.PI * 2);
    ctx.fillStyle = scene.theme === 'light' ? '#ffffff' : '#0e161c';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(p.x, p.y, rad, 0, Math.PI * 2);
    ctx.fillStyle = t.selected ? P.accent : P.ink;
    ctx.fill();
    if (t.selected || zoom > 12.2) {
      const tw = ctx.measureText(t.label).width;
      ctx.fillStyle = P.ink;
      roundRect(ctx, p.x + rad + 5, p.y - 10, tw + 12, 20, 5);
      ctx.fill();
      ctx.fillStyle = scene.theme === 'light' ? '#ffffff' : '#0e161c';
      ctx.textAlign = 'left';
      ctx.fillText(t.label, p.x + rad + 11, p.y + 0.5);
    }
  }
  ctx.restore();
}

function strokePath(ctx: CanvasRenderingContext2D, pj: Projector, path: LngLat[], color: string, width: number, alpha: number, casing: string) {
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const p = polyline(pj, path);
  ctx.globalAlpha = Math.min(1, alpha + 0.1);
  ctx.strokeStyle = casing;
  ctx.lineWidth = width + 3;
  ctx.stroke(p);
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke(p);
  ctx.restore();
}

function endpoint(ctx: CanvasRenderingContext2D, pj: Projector, pos: LngLat, color: string, letter: string) {
  const p = pj.point(pos);
  if (!p) return;
  ctx.save();
  ctx.beginPath();
  ctx.arc(p.x, p.y, 12, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 12px "Public Sans Variable", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(letter, p.x, p.y + 0.5);
  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
