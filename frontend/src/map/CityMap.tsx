import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import maplibregl, { type GeoJSONSource, type Map as MLMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Home, TriangleAlert } from 'lucide-react';
import { api } from '../api';
import { useStore } from '../store';
import type { FC, Hotspot, LayerToggles, Selection } from '../types';
import { geometryBBox, pointInGeometry, polygonRings, type LngLat } from '../lib/geo';
import { CLICKABLE, SRC, buildStyle, zoneHeight } from './style';
import { depotsData, floodsData, needs3dData, needsData, selectionData, zoneLabelsData, zonesData } from './data';
import { EMPTY_SCENE, depotMetrics, drawScene, makeProjector, type DepotDraw, type Scene } from './overlay';

export interface CityMapFocus {
  nonce: number;
  bbox?: [LngLat, LngLat];
  center?: LngLat;
  zoom?: number;
  pitch?: number;
}
export interface Pad { top: number; right: number; bottom: number; left: number }

interface Props {
  layers: LayerToggles;
  riskMode?: 'full' | 'faint';
  selection: Selection | null;
  onSelect: (s: Selection | null) => void;
  onRoadPick?: (lng: number, lat: number) => void;
  focus?: CityMapFocus | null;
  scene?: Partial<Omit<Scene, 'rings' | 'theme'>>;
  padding?: Pad;
  /** Fly the camera to a depot, area or zone as soon as it is selected. */
  autoFocus?: boolean;
  /** Which bottom corner holds the zoom buttons. */
  controls?: 'left' | 'right';
  children?: ReactNode;
}

/** Camera tilt in the 3D view: steep enough that heights read as heights. */
const TILT = 60;
const OVERVIEW_TILT = 58;
const MAX_BOUNDS: [[number, number], [number, number]] = [[79.75, 12.55], [80.62, 13.55]];
const ATTRIBUTION =
  '<a href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a> © <a href="https://www.openmaptiles.org/" target="_blank" rel="noreferrer">OpenMapTiles</a> data from <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> · zones: Datameet / Transparent Chennai (CC BY-SA 2.5 IN)';

const GROUPS: Record<keyof LayerToggles, string[]> = {
  risk: ['zones-fill', 'zones-line', 'zones-3d'],
  floods: ['floods-fill', 'floods-line'],
  depots: ['depot-labels'],
  needs: ['needs', 'needs-halo', 'needs-labels', 'needs-3d'],
  roads: ['road-state-slow', 'road-state-blocked'],
};

export default function CityMap({ layers, riskMode = 'full', selection, onSelect, onRoadPick, focus, scene, padding, autoFocus = false, controls = 'right', children }: Props) {
  const { zones, outline, bounds, state, theme } = useStore();
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const overlay = useRef<HTMLCanvasElement | null>(null);
  const [ready, setReady] = useState(false);
  const [tilesFailed, setTilesFailed] = useState(false);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [roadFC, setRoadFC] = useState<FC | null>(null);
  const [flat, setFlat] = useState(false);
  const home = useRef<{ center: [number, number]; zoom: number } | null>(null);
  const hoverId = useRef<string | null>(null);
  const selZone = useRef<string | null>(null);

  const rings = useMemo(() => (outline ? polygonRings(outline.geometry) : []), [outline]);
  const sceneRef = useRef<Scene>({ ...EMPTY_SCENE });
  const depotDraw = useMemo<DepotDraw[]>(() => (!layers.depots ? [] : (state?.warehouses ?? []).map((d) => ({
    id: d.id, pos: [d.lng, d.lat] as LngLat, scale: d.scale, active: d.active, selected: selection?.kind === 'depot' && selection.id === d.id,
  }))), [state, layers.depots, selection]);
  sceneRef.current = { ...EMPTY_SCENE, ...scene, depots: depotDraw, rings, theme };

  const live = useRef({ zones, state, hotspots, roadFC, layers, riskMode, selection, outline, onSelect, onRoadPick, theme });
  live.current = { zones, state, hotspots, roadFC, layers, riskMode, selection, outline, onSelect, onRoadPick, theme };
  const padRef = useRef<Pad | undefined>(padding);
  padRef.current = padding;
  const flatRef = useRef(false);
  flatRef.current = flat;
  const lastFocus = useRef<string | null>(null);
  const paintMode = useRef<string>('full');
  /** Where the camera was before the first fly-in, so closing a place can zoom back out to it. */
  const before = useRef<{ center: [number, number]; zoom: number; pitch: number; bearing: number } | null>(null);

  useEffect(() => { api.hotspots().then(setHotspots).catch(() => undefined); }, []);
  const netVersion = state?.network.version;
  useEffect(() => {
    api.overlay().then(setRoadFC).catch(() => setRoadFC(null));
  }, [netVersion]);

  // ------------------------------------------------------------------ push data to the style
  const sync = useCallback(() => {
    const map = mapRef.current;
    const L = live.current;
    if (!map || !map.getSource(SRC.zones) || !L.zones) return;
    const set = (id: string, data: GeoJSON.FeatureCollection) => (map.getSource(id) as GeoJSONSource | undefined)?.setData(data);
    set(SRC.zones, zonesData(L.zones, L.state));
    set(SRC.zoneLabels, zoneLabelsData(L.zones));
    const areas = L.state?.affected_areas ?? [];
    const depots = L.state?.warehouses ?? [];
    set(SRC.floods, floodsData(areas, L.hotspots));
    set(SRC.depots, depotsData(depots));
    set(SRC.needs, needsData(areas));
    set(SRC.needs3d, needs3dData(areas));
    set(SRC.roadState, L.roadFC ?? { type: 'FeatureCollection', features: [] });
    const sel = selectionData(L.selection, depots, areas);
    set(SRC.selection, sel.ring);
    set(SRC.selectionLine, sel.line);

    // visibility
    (Object.keys(GROUPS) as (keyof LayerToggles)[]).forEach((k) => {
      GROUPS[k].forEach((id) => {
        if (!map.getLayer(id)) return;
        map.setLayoutProperty(id, 'visibility', L.layers[k] ? 'visible' : 'none');
      });
    });
    if (map.getLayer('zones-3d') && paintMode.current !== L.riskMode) {
      paintMode.current = L.riskMode;
      const faint = L.riskMode === 'faint';
      map.setPaintProperty('zones-3d', 'fill-extrusion-opacity', faint ? 0.5 : 0.88);
      map.setPaintProperty('zones-3d', 'fill-extrusion-height', zoneHeight(faint ? 0.45 : 1));
    }
    if (map.getLayer('zones-fill')) {
      map.setPaintProperty('zones-fill', 'fill-opacity', L.riskMode === 'faint'
        ? ['interpolate', ['linear'], ['zoom'], 9, 0.22, 14, 0.1]
        : ['interpolate', ['linear'], ['zoom'], 9, 0.5, 12.5, 0.38, 14, 0.2]);
    }

    // selected zone outline via feature-state
    const wantZone = L.selection?.kind === 'zone' ? L.selection.id : null;
    if (selZone.current && selZone.current !== wantZone) map.setFeatureState({ source: SRC.zones, id: selZone.current }, { selected: false });
    if (wantZone) map.setFeatureState({ source: SRC.zones, id: wantZone }, { selected: true });
    selZone.current = wantZone;
  }, []);

  // ------------------------------------------------------------------ create map once
  useEffect(() => {
    if (!host.current || !bounds || mapRef.current) return;
    const map = new maplibregl.Map({
      container: host.current,
      style: buildStyle(live.current.theme),
      center: [80.19, 13.04],
      zoom: 10.4,
      pitch: OVERVIEW_TILT,
      bearing: -8,
      minZoom: 9.2,
      maxZoom: 17.8,
      maxPitch: 72,
      maxBounds: MAX_BOUNDS,
      attributionControl: { compact: true, customAttribution: ATTRIBUTION },
      dragRotate: true,
      fadeDuration: 150,
    });
    mapRef.current = map;
    if (import.meta.env.DEV) (window as unknown as { __crcMap?: MLMap }).__crcMap = map;
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true, showZoom: true }), controls === 'left' ? 'bottom-left' : 'bottom-right');

    // overlay canvas: hides everything outside Chennai and draws routes and trucks above the 3D buildings
    const cv = document.createElement('canvas');
    cv.className = 'map-overlay';
    map.getCanvasContainer().appendChild(cv);
    overlay.current = cv;
    const ctx = cv.getContext('2d');
    const draw = () => {
      if (!ctx) return;
      const r = map.getContainer().getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const w = Math.round(r.width);
      const h = Math.round(r.height);
      if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
        cv.width = Math.round(w * dpr);
        cv.height = Math.round(h * dpr);
        cv.style.width = `${w}px`;
        cv.style.height = `${h}px`;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawScene(ctx, map, sceneRef.current, w, h);
    };
    map.on('render', draw);
    const ro = new ResizeObserver(() => { map.resize(); });
    ro.observe(host.current);

    map.on('style.load', () => { setReady(true); sync(); });

    map.on('error', (e) => {
      const err = e as unknown as { sourceId?: string; error?: { status?: number; message?: string } };
      if (err.sourceId === SRC.omt || /Failed to fetch|NetworkError|AJAX/i.test(err.error?.message ?? '')) setTilesFailed(true);
    });
    map.on('sourcedata', (e) => {
      if (e.sourceId === SRC.omt && e.isSourceLoaded) setTilesFailed(false);
    });

    // ---- interaction
    const existing = (ids: readonly string[]) => ids.filter((id) => map.getLayer(id));
    const hitDepot = (x: number, y: number): string | null => {
      const L = live.current;
      if (!L.layers.depots) return null;
      const pj = makeProjector(map);
      for (const d of L.state?.warehouses ?? []) {
        const g = pj.point([d.lng, d.lat]);
        if (!g) continue;
        const dm = depotMetrics(d.scale, map.getZoom());
        const hy = g.y - dm.stem - dm.size / 2;
        if (Math.hypot(x - g.x, y - hy) <= Math.max(dm.size * 0.8, 9) || Math.hypot(x - g.x, y - g.y) <= 9) return d.id;
      }
      return null;
    };
    map.on('click', (e) => {
      const L = live.current;
      const pt = [e.lngLat.lng, e.lngLat.lat] as LngLat;
      if (L.outline && !pointInGeometry(pt, L.outline.geometry)) { L.onSelect(null); return; }
      const depot = hitDepot(e.point.x, e.point.y);
      if (depot) { L.onSelect({ kind: 'depot', id: depot }); return; }
      const marks = map.queryRenderedFeatures(e.point, { layers: existing(['needs', 'needs-3d']) });
      if (marks.length) { L.onSelect({ kind: 'area', id: String(marks[0].properties?.id) }); return; }
      if (L.layers.roads && L.onRoadPick && map.getZoom() >= 11.8) { L.onRoadPick(pt[0], pt[1]); return; }
      const zf = map.queryRenderedFeatures(e.point, { layers: existing(['zones-3d', 'zones-fill']) });
      if (zf.length) L.onSelect({ kind: 'zone', id: String(zf[0].properties?.id) });
      else L.onSelect(null);
    });
    map.on('mousemove', (e) => {
      const L = live.current;
      const marks = hitDepot(e.point.x, e.point.y) ? [1] : map.queryRenderedFeatures(e.point, { layers: existing(['needs', 'needs-3d']) });
      const zf = marks.length ? [] : map.queryRenderedFeatures(e.point, { layers: existing(['zones-3d', 'zones-fill']) });
      map.getCanvas().style.cursor = marks.length || zf.length || (L.layers.roads && map.getZoom() >= 11.8) ? 'pointer' : '';
      const id = zf.length ? String(zf[0].properties?.id) : null;
      if (id !== hoverId.current) {
        if (hoverId.current) map.setFeatureState({ source: SRC.zones, id: hoverId.current }, { hover: false });
        if (id) map.setFeatureState({ source: SRC.zones, id }, { hover: true });
        hoverId.current = id;
      }
    });
    map.on('mouseout', () => {
      if (hoverId.current) map.setFeatureState({ source: SRC.zones, id: hoverId.current }, { hover: false });
      hoverId.current = null;
    });

    return () => { ro.disconnect(); map.remove(); mapRef.current = null; overlay.current = null; setReady(false); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bounds]);

  // fit the whole city once the map exists
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !bounds || home.current) return;
    fitCity(false, 0);
    home.current = { center: map.getCenter().toArray() as [number, number], zoom: map.getZoom() };
  }, [ready, bounds]);

  // theme change -> new style
  const firstTheme = useRef(theme);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || theme === firstTheme.current) return;
    firstTheme.current = theme;
    paintMode.current = 'full';
    map.setStyle(buildStyle(theme));
  }, [theme]);

  // data / selection / layer changes
  useEffect(() => { sync(); }, [sync, ready, zones, state, hotspots, roadFC, layers, riskMode, selection]);
  // scene changes repaint the overlay
  useEffect(() => { mapRef.current?.triggerRepaint(); }, [scene, rings, theme]);

  // camera requests
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focus || !ready) return;
    const pad = padding ?? { top: 60, right: 60, bottom: 60, left: 60 };
    if (focus.bbox) map.fitBounds(focus.bbox, { padding: pad, duration: 900, maxZoom: 13.1, pitch: flat ? 0 : focus.pitch ?? OVERVIEW_TILT });
    else if (focus.center) map.easeTo({ center: focus.center, zoom: focus.zoom ?? 14, duration: 900, pitch: flat ? 0 : focus.pitch ?? 58, padding: pad });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.nonce, ready]);

  // fly to whatever was just selected: a depot or area up close, a zone framed whole
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !autoFocus) return;
    if (!selection) {
      // closed: zoom back out to wherever the camera was before the first fly-in
      lastFocus.current = null;
      const back = before.current;
      before.current = null;
      if (back) {
        map.flyTo({
          center: back.center, zoom: back.zoom, pitch: flatRef.current ? 0 : back.pitch, bearing: back.bearing,
          padding: padRef.current ?? { top: 60, right: 60, bottom: 60, left: 60 }, duration: 1200, curve: 1.3, essential: true,
        });
      }
      return;
    }
    if (selection.kind === 'road') return;
    const key = `${selection.kind}:${selection.id}`;
    if (lastFocus.current === key) return;
    lastFocus.current = key;
    if (!before.current) {
      const c = map.getCenter();
      before.current = { center: [c.lng, c.lat], zoom: map.getZoom(), pitch: map.getPitch(), bearing: map.getBearing() };
    }
    const L = live.current;
    const pad = padRef.current ?? { top: 60, right: 60, bottom: 60, left: 60 };
    const pitch = flatRef.current ? 0 : Math.max(map.getPitch(), 58);
    if (selection.kind === 'depot') {
      const d = L.state?.warehouses.find((w) => w.id === selection.id);
      if (d) map.flyTo({ center: [d.lng, d.lat], zoom: Math.min(Math.max(map.getZoom(), 15.4), 16.8), pitch, padding: pad, duration: 1500, curve: 1.35, essential: true });
    } else if (selection.kind === 'area') {
      const a = L.state?.affected_areas.find((x) => x.id === selection.id);
      const r = L.hotspots.find((h) => h.id === a?.hotspot_id)?.radius_m ?? 700;
      if (a) map.flyTo({ center: [a.lng, a.lat], zoom: Math.min(Math.max(map.getZoom(), r > 1200 ? 14.1 : 14.7), 16.2), pitch, padding: pad, duration: 1400, curve: 1.35, essential: true });
    } else {
      const f = L.zones?.features.find((x) => String(x.properties.id) === selection.id);
      if (f && map.getZoom() < 13.4) map.fitBounds(geometryBBox(f.geometry), { padding: pad, maxZoom: 13.1, pitch: flatRef.current ? 0 : Math.max(map.getPitch(), 54), duration: 1100 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection, ready, autoFocus]);

  // frames the whole city. The tilted view is fitted as if seen from above, then zoomed in a little,
  // because tilting foreshortens the city and would otherwise leave it small in the middle of the screen.
  const fitCity = (flatView: boolean, duration: number) => {
    const map = mapRef.current;
    if (!map || !bounds) return;
    const padding = flatView ? { top: 70, bottom: 40, left: 30, right: 30 } : { top: 56, bottom: 110, left: 30, right: 30 };
    const bearing = flatView ? 0 : -8;
    const cam = map.cameraForBounds(bounds, { padding, bearing });
    if (!cam || !cam.center) return;
    const c = cam.center as maplibregl.LngLat;
    map.easeTo({
      center: [c.lng, c.lat], zoom: Math.min((cam.zoom ?? 10.4) + (flatView ? 0 : 0.6), 11.6),
      pitch: flatView ? 0 : OVERVIEW_TILT, bearing, duration,
    });
  };
  const resetView = () => {
    before.current = null;
    fitCity(flat, 900);
  };
  const toggleFlat = () => {
    const map = mapRef.current;
    if (!map) return;
    const next = !flat;
    setFlat(next);
    // from the city overview, show the whole city in the new view; zoomed in, stay where you are and just tilt
    if (map.getZoom() < 12) fitCity(next, 900);
    else map.easeTo({ pitch: next ? 0 : TILT, bearing: next ? 0 : -8, duration: 900 });
  };

  return (
    <div className={`citymap citymap--ctl-${controls}`}>
      <div ref={host} className="citymap__gl" />
      <div className="citymap__tools" role="toolbar" aria-label="Map view">
        <div className="segmented viewswitch" role="group" aria-label="Map view">
          <button aria-pressed={flat} onClick={() => !flat && toggleFlat()} title="Flat, top-down view">2D</button>
          <button aria-pressed={!flat} onClick={() => flat && toggleFlat()} title="Tilted view with raised zones, columns and buildings">3D</button>
        </div>
        <button className="maptool" onClick={resetView} title="Show all of Chennai"><Home size={16} /><span>All Chennai</span></button>
      </div>
      {tilesFailed && (
        <div className="citymap__warn" role="status">
          <TriangleAlert size={16} />
          <span>Street map tiles could not load. Check your internet connection. Risk, depots and routes still work.</span>
        </div>
      )}
      <div className="citymap__ui">{children}</div>
    </div>
  );
}
