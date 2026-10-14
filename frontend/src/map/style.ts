import type { StyleSpecification, LayerSpecification, ExpressionSpecification } from 'maplibre-gl';

export type Theme = 'light' | 'dark';

export const TILE_URL = 'https://tiles.openfreemap.org/planet';
export const GLYPHS = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf';
const FONT = ['Noto Sans Regular'];
const FONT_BOLD = ['Noto Sans Bold'];

export interface Palette {
  board: string; land: string; park: string; wood: string; water: string; waterLine: string;
  roadFill: string; roadCase: string; rail: string; apron: string;
  bldLow: string; bldHigh: string; label: string; labelHalo: string; zoneLabel: string;
  depot: string; depotTop: string; line: string; shadow: string; slabA: string; slabB: string; accent: string; flood: string; floodLine: string;
  ink: string;
}

export const PALETTE: Record<Theme, Palette> = {
  light: {
    board: '#e8ecec', land: '#eef1f1', park: '#c9dfbc', wood: '#d3e4c8', water: '#a9cde8', waterLine: '#9cc3e0',
    roadFill: '#ffffff', roadCase: '#ccd4d7', rail: '#c2cbcf', apron: '#dde2e3',
    bldLow: '#dfe4e7', bldHigh: '#b4bec5', label: '#44565f', labelHalo: '#f1f4f4', zoneLabel: '#15232e',
    depot: '#15232e', depotTop: '#284a96', line: '#9fb0b8', shadow: 'rgba(21,35,46,0.24)', slabA: '#cfd7d9', slabB: '#aab6bb',
    accent: '#284a96', flood: '#3f86c0', floodLine: '#2f6ea5', ink: '#15232e',
  },
  dark: {
    board: '#0e161c', land: '#121c23', park: '#173126', wood: '#16302a', water: '#173a52', waterLine: '#1d4965',
    roadFill: '#3a5060', roadCase: '#0b1115', rail: '#33454f', apron: '#1a252d',
    bldLow: '#3d515c', bldHigh: '#6a8698', label: '#9fb1bb', labelHalo: '#0e161c', zoneLabel: '#e7eef2',
    depot: '#e7eef2', depotTop: '#7fa2f0', line: '#4a5f6c', shadow: 'rgba(0,0,0,0.55)', slabA: '#1a2a34', slabB: '#0a1218',
    accent: '#7fa2f0', flood: '#4a95cf', floodLine: '#7ab6e6', ink: '#e7eef2',
  },
};

export const LEVEL_COLOR = { Low: '#3f9a7b', Elevated: '#d8a52a', High: '#e0702f', Severe: '#c4303a' } as const;
export const SEV_COLOR = { Low: '#3f9a7b', Medium: '#d8a52a', High: '#e0702f', Critical: '#c4303a' } as const;

const zi = (...stops: (number | string | ExpressionSpecification)[]): ExpressionSpecification =>
  ['interpolate', ['linear'], ['zoom'], ...stops] as ExpressionSpecification;

/** Risk colour from a 0-100 score. */
export const riskColor: ExpressionSpecification = [
  'interpolate', ['linear'], ['coalesce', ['get', 'risk'], 0],
  0, LEVEL_COLOR.Low, 24, LEVEL_COLOR.Low, 38, LEVEL_COLOR.Elevated, 52, LEVEL_COLOR.High, 76, LEVEL_COLOR.Severe, 100, '#8c1c2d',
] as ExpressionSpecification;

/** Height of a zone prism at each zoom. Tall in the overview, melting away as real buildings take over. */
export const zoneHeight = (scale: number): ExpressionSpecification => [
  'interpolate', ['linear'], ['zoom'],
  11.8, ['*', ['get', 'h'], scale], 12.9, ['*', ['get', 'h'], 0.2 * scale], 13.4, 0,
] as unknown as ExpressionSpecification;

export const SRC = {
  omt: 'omt', zones: 'zones', zoneLabels: 'zone-labels', floods: 'floods', depots: 'depots',
  needs: 'needs', needs3d: 'needs-3d', roadState: 'road-state', selection: 'selection', selectionLine: 'selection-line',
} as const;

const empty: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

export function buildStyle(theme: Theme): StyleSpecification {
  const p = PALETTE[theme];
  const L: LayerSpecification[] = [];
  const road = ['!in', 'brunnel', 'tunnel'] as unknown as ExpressionSpecification;

  L.push({ id: 'bg', type: 'background', paint: { 'background-color': p.board } });
  L.push({ id: 'landcover', type: 'fill', source: SRC.omt, 'source-layer': 'landcover',
    filter: ['in', 'class', 'grass', 'wood', 'wetland'] as unknown as ExpressionSpecification,
    paint: { 'fill-color': ['match', ['get', 'class'], 'wood', p.wood, 'wetland', p.wood, p.park], 'fill-opacity': 0.75 } });
  L.push({ id: 'park', type: 'fill', source: SRC.omt, 'source-layer': 'park', paint: { 'fill-color': p.park, 'fill-opacity': 0.9 } });
  L.push({ id: 'landuse-green', type: 'fill', source: SRC.omt, 'source-layer': 'landuse',
    filter: ['in', 'class', 'cemetery', 'pitch', 'playground', 'stadium', 'zoo'] as unknown as ExpressionSpecification,
    paint: { 'fill-color': p.park, 'fill-opacity': 0.6 } });
  L.push({ id: 'aeroway-apron', type: 'fill', source: SRC.omt, 'source-layer': 'aeroway', filter: ['==', '$type', 'Polygon'] as unknown as ExpressionSpecification,
    paint: { 'fill-color': p.apron } });
  L.push({ id: 'water', type: 'fill', source: SRC.omt, 'source-layer': 'water', paint: { 'fill-color': p.water } });
  L.push({ id: 'waterway', type: 'line', source: SRC.omt, 'source-layer': 'waterway', minzoom: 9,
    paint: { 'line-color': p.waterLine, 'line-width': zi(9, 0.6, 13, 2, 16, 6) } });

  // --- our hazard layers: sit on the ground, under roads and buildings
  L.push({ id: 'zones-fill', type: 'fill', source: SRC.zones,
    paint: { 'fill-color': riskColor, 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 9, 0.5, 12.5, 0.38, 14, 0.2] as unknown as ExpressionSpecification } });
  L.push({ id: 'zones-line', type: 'line', source: SRC.zones,
    paint: {
      'line-color': ['case', ['boolean', ['feature-state', 'selected'], false], p.accent, ['boolean', ['feature-state', 'hover'], false], p.accent, p.ink] as unknown as ExpressionSpecification,
      'line-opacity': ['case', ['boolean', ['feature-state', 'selected'], false], 1, ['boolean', ['feature-state', 'hover'], false], 0.9, 0.3] as unknown as ExpressionSpecification,
      'line-width': ['case', ['boolean', ['feature-state', 'selected'], false], 3, ['boolean', ['feature-state', 'hover'], false], 2.2, 1] as unknown as ExpressionSpecification,
    } });
  L.push({ id: 'floods-fill', type: 'fill', source: SRC.floods,
    paint: { 'fill-color': p.flood, 'fill-opacity': ['interpolate', ['linear'], ['get', 'intensity'], 0, 0.18, 100, 0.62] as unknown as ExpressionSpecification } });
  L.push({ id: 'floods-line', type: 'line', source: SRC.floods,
    paint: { 'line-color': p.floodLine, 'line-width': 1.2, 'line-opacity': 0.9 } });

  // --- roads
  L.push({ id: 'rail', type: 'line', source: SRC.omt, 'source-layer': 'transportation', minzoom: 11,
    filter: ['==', 'class', 'rail'] as unknown as ExpressionSpecification,
    paint: { 'line-color': p.rail, 'line-width': zi(11, 0.6, 16, 2), 'line-dasharray': [4, 3] } });
  const majorCls = ['motorway', 'trunk', 'primary', 'secondary'];
  const minorCls = ['tertiary', 'minor', 'service'];
  L.push({ id: 'road-minor-case', type: 'line', source: SRC.omt, 'source-layer': 'transportation', minzoom: 12.5,
    filter: ['all', ['in', 'class', ...minorCls], road] as unknown as ExpressionSpecification, layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': p.roadCase, 'line-width': zi(12.5, 0.8, 15, 3, 17, 11) } });
  L.push({ id: 'road-minor', type: 'line', source: SRC.omt, 'source-layer': 'transportation', minzoom: 12.5,
    filter: ['all', ['in', 'class', ...minorCls], road] as unknown as ExpressionSpecification, layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': p.roadFill, 'line-width': zi(12.5, 0.4, 15, 2, 17, 9) } });
  L.push({ id: 'road-major-case', type: 'line', source: SRC.omt, 'source-layer': 'transportation', minzoom: 8,
    filter: ['all', ['in', 'class', ...majorCls], road] as unknown as ExpressionSpecification, layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': p.roadCase, 'line-width': zi(8, 0.8, 11, 2.6, 13, 4.5, 15, 9, 17, 22) } });
  L.push({ id: 'road-major', type: 'line', source: SRC.omt, 'source-layer': 'transportation', minzoom: 8,
    filter: ['all', ['in', 'class', ...majorCls], road] as unknown as ExpressionSpecification, layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': p.roadFill, 'line-width': zi(8, 0.4, 11, 1.6, 13, 3, 15, 7, 17, 19) } });

  // --- blocked / slow roads from our network model
  L.push({ id: 'road-state-slow', type: 'line', source: SRC.roadState, filter: ['==', ['get', 'status'], 'slow'] as unknown as ExpressionSpecification,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': LEVEL_COLOR.Elevated, 'line-width': zi(9, 1.6, 13, 3.4, 16, 7), 'line-opacity': 0.95 } });
  L.push({ id: 'road-state-blocked', type: 'line', source: SRC.roadState, filter: ['==', ['get', 'status'], 'blocked'] as unknown as ExpressionSpecification,
    layout: { 'line-cap': 'butt', 'line-join': 'round' },
    paint: { 'line-color': LEVEL_COLOR.Severe, 'line-width': zi(9, 2, 13, 4, 16, 8), 'line-dasharray': [1.6, 1.2] } });
  L.push({ id: 'selection-line', type: 'line', source: SRC.selectionLine,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': p.accent, 'line-width': zi(9, 4, 16, 10), 'line-opacity': 0.9 } });

  // --- 3D: zone prisms (overview) fade into real buildings (z13+)
  L.push({ id: 'zones-3d', type: 'fill-extrusion', source: SRC.zones, maxzoom: 13.6,
    paint: {
      'fill-extrusion-color': ['case', ['boolean', ['feature-state', 'selected'], false], p.accent, riskColor] as unknown as ExpressionSpecification,
      'fill-extrusion-opacity': 0.88,
      'fill-extrusion-base': 0,
      'fill-extrusion-height': zoneHeight(1),
      'fill-extrusion-vertical-gradient': true,
    } });
  L.push({ id: 'buildings', type: 'fill-extrusion', source: SRC.omt, 'source-layer': 'building', minzoom: 13,
    filter: ['!=', ['get', 'hide_3d'], true] as unknown as ExpressionSpecification,
    paint: {
      'fill-extrusion-color': ['interpolate', ['linear'], ['coalesce', ['get', 'render_height'], 6], 0, p.bldLow, 60, p.bldHigh] as unknown as ExpressionSpecification,
      // heights are exaggerated a little: most Chennai buildings are low and would barely stand up otherwise
      'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 13, 0, 14.2, ['*', 1.6, ['max', ['coalesce', ['get', 'render_height'], 7], 7]]] as unknown as ExpressionSpecification,
      'fill-extrusion-base': ['interpolate', ['linear'], ['zoom'], 13, 0, 14.2, ['*', 1.6, ['coalesce', ['get', 'render_min_height'], 0]]] as unknown as ExpressionSpecification,
      'fill-extrusion-opacity': theme === 'light' ? 0.98 : 0.96,
      'fill-extrusion-vertical-gradient': true,
    } });
  // a column for every area that needs relief: taller means more people affected
  L.push({ id: 'needs-3d', type: 'fill-extrusion', source: SRC.needs3d, maxzoom: 14.8,
    paint: {
      'fill-extrusion-color': ['get', 'color'] as unknown as ExpressionSpecification,
      'fill-extrusion-opacity': 0.94,
      'fill-extrusion-base': 0,
      'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 12.5, ['get', 'h'], 14.2, ['*', ['get', 'h'], 0.12], 14.8, 0] as unknown as ExpressionSpecification,
      'fill-extrusion-vertical-gradient': true,
    } });
  // --- markers drawn by the GL layer
  L.push({ id: 'needs-halo', type: 'circle', source: SRC.needs,
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, ['+', 5, ['*', 1.6, ['get', 'r']]], 15, ['+', 11, ['*', 3, ['get', 'r']]]] as unknown as ExpressionSpecification,
      'circle-color': ['get', 'color'], 'circle-opacity': 0.18, 'circle-pitch-alignment': 'map',
    } });
  L.push({ id: 'needs', type: 'circle', source: SRC.needs,
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, ['+', 2.6, ['*', 0.7, ['get', 'r']]], 15, ['+', 5, ['*', 1.4, ['get', 'r']]]] as unknown as ExpressionSpecification,
      'circle-color': ['get', 'color'], 'circle-stroke-color': theme === 'light' ? '#ffffff' : '#0e161c', 'circle-stroke-width': 1.6,
    } });
  L.push({ id: 'selection-ring', type: 'circle', source: SRC.selection,
    paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, 11, 15, 22] as unknown as ExpressionSpecification, 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': p.accent, 'circle-stroke-width': 2.4 } });

  // --- labels
  L.push({ id: 'water-name', type: 'symbol', source: SRC.omt, 'source-layer': 'water_name', minzoom: 10,
    layout: { 'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']] as unknown as ExpressionSpecification, 'text-font': ['Noto Sans Italic'], 'text-size': 11, 'symbol-placement': 'point' },
    paint: { 'text-color': theme === 'light' ? '#4f8fc0' : '#6fa9d4', 'text-halo-color': p.labelHalo, 'text-halo-width': 1.2 } });
  L.push({ id: 'road-name', type: 'symbol', source: SRC.omt, 'source-layer': 'transportation_name', minzoom: 13,
    filter: ['in', 'class', 'motorway', 'trunk', 'primary', 'secondary'] as unknown as ExpressionSpecification,
    layout: { 'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']] as unknown as ExpressionSpecification, 'text-font': FONT, 'text-size': 11, 'symbol-placement': 'line', 'text-letter-spacing': 0.02 },
    paint: { 'text-color': p.label, 'text-halo-color': p.labelHalo, 'text-halo-width': 1.4 } });
  L.push({ id: 'place-small', type: 'symbol', source: SRC.omt, 'source-layer': 'place', minzoom: 12,
    filter: ['in', 'class', 'suburb', 'neighbourhood', 'quarter', 'village', 'town'] as unknown as ExpressionSpecification,
    layout: { 'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']] as unknown as ExpressionSpecification, 'text-font': FONT, 'text-size': zi(12, 10.5, 16, 13), 'text-max-width': 8 },
    paint: { 'text-color': p.label, 'text-halo-color': p.labelHalo, 'text-halo-width': 1.4, 'text-opacity': zi(12, 0, 13, 1) } });
  L.push({ id: 'zone-labels', type: 'symbol', source: SRC.zoneLabels, maxzoom: 13.4,
    layout: {
      'text-field': ['get', 'name'] as unknown as ExpressionSpecification, 'text-font': FONT_BOLD, 'text-size': zi(9, 10.5, 12.5, 13),
      'text-max-width': 7, 'text-allow-overlap': false, 'symbol-sort-key': ['*', -1, ['get', 'pop']] as unknown as ExpressionSpecification,
    },
    paint: { 'text-color': p.zoneLabel, 'text-halo-color': p.labelHalo, 'text-halo-width': 1.6, 'text-opacity': zi(12.6, 1, 13.4, 0) } });
  L.push({ id: 'depot-labels', type: 'symbol', source: SRC.depots, minzoom: 11.5,
    layout: { 'text-field': ['get', 'short'] as unknown as ExpressionSpecification, 'text-font': FONT_BOLD, 'text-size': 11.5, 'text-offset': [0, 0.9], 'text-anchor': 'top', 'text-max-width': 9, 'text-optional': true },
    paint: { 'text-color': p.ink, 'text-halo-color': p.labelHalo, 'text-halo-width': 1.6 } });
  L.push({ id: 'needs-labels', type: 'symbol', source: SRC.needs, minzoom: 13,
    layout: { 'text-field': ['get', 'name'] as unknown as ExpressionSpecification, 'text-font': FONT, 'text-size': 11, 'text-offset': [0, 1.1], 'text-anchor': 'top', 'text-max-width': 9, 'text-optional': true },
    paint: { 'text-color': p.label, 'text-halo-color': p.labelHalo, 'text-halo-width': 1.4 } });

  return {
    version: 8,
    glyphs: GLYPHS,
    light: { anchor: 'viewport', color: '#ffffff', intensity: theme === 'light' ? 0.6 : 0.5, position: [1.25, 215, 48] },
    sources: {
      [SRC.omt]: { type: 'vector', url: TILE_URL },
      [SRC.zones]: { type: 'geojson', data: empty, promoteId: 'id' },
      [SRC.zoneLabels]: { type: 'geojson', data: empty },
      [SRC.floods]: { type: 'geojson', data: empty },
      [SRC.depots]: { type: 'geojson', data: empty, promoteId: 'id' },
      [SRC.needs]: { type: 'geojson', data: empty, promoteId: 'id' },
      [SRC.needs3d]: { type: 'geojson', data: empty },
      [SRC.roadState]: { type: 'geojson', data: empty },
      [SRC.selection]: { type: 'geojson', data: empty },
      [SRC.selectionLine]: { type: 'geojson', data: empty },
    },
    layers: L,
  };
}

/** Layers that respond to clicks, in priority order. */
export const CLICKABLE = ['needs', 'needs-3d', 'zones-3d', 'zones-fill'] as const;
