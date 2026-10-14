import { useCallback, useEffect, useMemo, useState } from 'react';
import { Layers, ListOrdered } from 'lucide-react';
import { api } from '../api';
import { useStore } from '../store';
import CityMap from '../map/CityMap';
import Inspector from '../components/Inspector';
import { AreasPanel, ConditionsPanel, LayersPanel } from '../components/MapPanels';
import type { LayerToggles, Selection } from '../types';
import { scoreLevel } from '../lib/format';

type Panel = 'meter' | 'areas' | 'layers';
const PANEL_TITLE: Record<Panel, string> = { meter: 'Disaster meter and conditions', areas: 'Areas by risk', layers: 'Map layers' };

function useMedia(query: string): boolean {
  const [on, setOn] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const m = window.matchMedia(query);
    const fn = () => setOn(m.matches);
    fn();
    m.addEventListener('change', fn);
    return () => m.removeEventListener('change', fn);
  }, [query]);
  return on;
}

export default function MapPage() {
  const { state, toast } = useStore();
  const [layers, setLayers] = useState<LayerToggles>({ risk: true, floods: true, depots: true, needs: true, roads: true });
  const [panel, setPanel] = useState<Panel | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const narrow = useMedia('(max-width: 980px)');

  const select = useCallback((s: Selection | null) => {
    setSelection(s);
    if (s) setPanel(null);
  }, []);
  const pickZone = useCallback((id: string) => select({ kind: 'zone', id }), [select]);
  const toggle = (p: Panel) => setPanel((cur) => (cur === p ? null : p));

  // a popup closes when you click anywhere else or press Escape
  useEffect(() => {
    if (!panel) return;
    const down = (e: PointerEvent) => { if (!(e.target as Element | null)?.closest?.('.popover, .maptop')) setPanel(null); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setPanel(null); };
    document.addEventListener('pointerdown', down);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('pointerdown', down); document.removeEventListener('keydown', key); };
  }, [panel]);

  // Escape also closes an open card (a photo viewer, if open, handles its own Escape first)
  useEffect(() => {
    if (!selection || panel) return;
    const key = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.key === 'Escape' && !t?.closest?.('input, select, textarea')) setSelection(null);
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [selection, panel]);

  const pickRoad = useCallback(async (lng: number, lat: number) => {
    try {
      const probe = await api.probeRoad(lat, lng);
      if (probe.found && (probe.distance_m ?? 0) < 400) select({ kind: 'road', probe });
      else toast('No road found at that spot. Click closer to a road.');
    } catch (e) { toast(e instanceof Error ? e.message : 'Could not look up that road', 'error'); }
  }, [toast, select]);

  const reprobeRoad = useCallback(async () => {
    if (selection?.kind !== 'road' || !selection.probe.geometry) return;
    const g = selection.probe.geometry;
    const mid = g[Math.floor(g.length / 2)];
    try { setSelection({ kind: 'road', probe: await api.probeRoad(mid[1], mid[0]) }); } catch { setSelection(null); }
  }, [selection]);

  // keep the thing you opened clear of the card that describes it
  const padding = useMemo(() => (narrow
    ? { top: 70, left: 24, right: 24, bottom: selection ? Math.round(window.innerHeight * 0.46) : 40 }
    : { top: 76, left: 60, right: selection ? 420 : 60, bottom: 56 }), [narrow, selection]);

  if (!state) return null;
  const sum = state.hazard.summary;
  const level = scoreLevel(sum.meter);

  return (
    <div className="page mappage">
      <CityMap layers={layers} selection={selection} onSelect={select} onRoadPick={pickRoad} autoFocus controls="left" padding={padding}>
        <div className="maptop" role="toolbar" aria-label="Map panels">
          <button className={`maptool maptool--meter ${panel === 'meter' ? 'is-on' : ''}`} aria-expanded={panel === 'meter'} aria-controls="pop-meter" onClick={() => toggle('meter')}
            title="Disaster meter, conditions and forecast">
            <i className="maptool__dot" style={{ background: `var(--lvl-${level.toLowerCase()})` }} />
            <span className="maptool__label">Disaster meter</span>
            <b className="num">{Math.round(sum.meter)}</b>
            <span className="maptool__level">{sum.level}</span>
            {state.network.source === 'fallback' && <i className="maptool__flag" title="Roads are approximate" />}
          </button>
          <button className={`maptool ${panel === 'areas' ? 'is-on' : ''}`} aria-expanded={panel === 'areas'} aria-controls="pop-areas" onClick={() => toggle('areas')} title="Every area, highest risk first">
            <ListOrdered size={16} /><span>Areas by risk</span>
          </button>
          <button className={`maptool ${panel === 'layers' ? 'is-on' : ''}`} aria-expanded={panel === 'layers'} aria-controls="pop-layers" onClick={() => toggle('layers')} title="Choose what the map shows">
            <Layers size={16} /><span>Layers</span>
          </button>
        </div>

        {panel && (
          <div className={`popover popover--${panel}`} id={`pop-${panel}`} role="dialog" aria-label={PANEL_TITLE[panel]}>
            {panel === 'meter' && <ConditionsPanel onPickZone={pickZone} />}
            {panel === 'areas' && <AreasPanel selection={selection} onPickZone={pickZone} />}
            {panel === 'layers' && <LayersPanel layers={layers} onChange={setLayers} />}
          </div>
        )}

        {selection && <Inspector selection={selection} onClose={() => setSelection(null)} onRoadChanged={reprobeRoad} />}
      </CityMap>
    </div>
  );
}
