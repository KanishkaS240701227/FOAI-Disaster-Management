import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useStore } from '../store';
import Gauge from './Gauge';
import Forecast from './Forecast';
import RoadDataNotice from './RoadDataNotice';
import type { LayerToggles, Selection } from '../types';
import { fmt, fmtPeople, scoreLevel } from '../lib/format';

export const LAYER_LABEL: [keyof LayerToggles, string][] = [
  ['risk', 'Risk by zone'], ['floods', 'Flood spots'], ['depots', 'Depots'], ['needs', 'Areas needing relief'], ['roads', 'Closed and slow roads'],
];

/** The disaster meter, today's readings and the 48-hour outlook. */
export function ConditionsPanel({ onPickZone }: { onPickZone: (id: string) => void }) {
  const { state, zones, zoneName } = useStore();
  if (!state) return null;
  const sum = state.hazard.summary;
  const h = state.hazard.state;
  const total = zones ? zones.features.filter((f) => state.hazard.zones[String(f.properties.id)]).length : 0;
  const level = scoreLevel(sum.meter);
  const quake = h.quakes[0];
  const headline = sum.zones_high === 0
    ? 'No area is at High or Severe risk right now.'
    : `${sum.zones_high} of ${total} areas are at High or Severe risk. ${fmtPeople(sum.pop_at_risk)} people live there.`;
  return (
    <>
      <section className="meter">
        <Gauge value={sum.meter} height={150} />
        <div className="meter__read">
          <p className="meter__label">Disaster meter</p>
          <div className="meter__num num" style={{ color: `var(--lvl-${level.toLowerCase()})` }}>{Math.round(sum.meter)}</div>
          <span className={`pill lvl-${sum.level}`}>{sum.level}</span>
          <p className="meter__line">{headline}</p>
          {sum.zones_high > 0 && <p className="muted meter__worst">Worst: <button className="linkish" onClick={() => onPickZone(sum.peak_zone)}>{zoneName(sum.peak_zone)}</button></p>}
        </div>
      </section>
      <section className="pop__sec">
        <h3>Conditions now</h3>
        <dl className="conds">
          <div><dt>Rain, 24 hours</dt><dd className="num">{fmt(h.rain24)} <small>mm</small></dd></div>
          <div><dt>Rain, 72 hours</dt><dd className="num">{fmt(h.rain72)} <small>mm</small></dd></div>
          <div><dt>Wind gusts</dt><dd className="num">{fmt(h.gust_kmh)} <small>km/h</small></dd></div>
          <div><dt>Sea surge</dt><dd className="num">{fmt(h.surge_m, 1)} <small>m</small></dd></div>
          {h.river_index != null && <div><dt>River level</dt><dd className="num">{Math.round(h.river_index * 100)}<small>% of flood stage</small></dd></div>}
          <div><dt>Earthquakes</dt><dd className="num">{quake ? <>M{quake.mag.toFixed(1)} <small>{fmt(quake.dist_km)} km away</small></> : <small>None felt</small>}</dd></div>
        </dl>
      </section>
      {h.timeline.length > 0 && (
        <section className="pop__sec">
          <h3>Next 48 hours</h3>
          <Forecast />
        </section>
      )}
      {state.network.source === 'fallback' && <section className="pop__sec"><RoadDataNotice compact /></section>}
    </>
  );
}

/** Every zone and suburb, highest risk first, with a quick filter. */
export function AreasPanel({ selection, onPickZone }: { selection: Selection | null; onPickZone: (id: string) => void }) {
  const { state, zones } = useStore();
  const [q, setQ] = useState('');
  const ranked = useMemo(() => {
    if (!state || !zones) return [];
    return zones.features
      .map((f) => ({ id: String(f.properties.id), name: String(f.properties.name), kind: String(f.properties.kind), number: f.properties.number as number | null, score: state.hazard.zones[String(f.properties.id)] }))
      .filter((z) => z.score)
      .sort((a, b) => b.score.overall - a.score.overall);
  }, [state, zones]);
  const shown = q.trim() ? ranked.filter((z) => z.name.toLowerCase().includes(q.trim().toLowerCase())) : ranked;
  return (
    <>
      <div className="pop__search">
        <Search size={15} aria-hidden="true" />
        <input className="input" type="search" placeholder="Find an area" aria-label="Find an area" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <ul className="zlist">
        {shown.map((z) => {
          const sel = selection?.kind === 'zone' && selection.id === z.id;
          return (
            <li key={z.id}>
              <button className="zrow" aria-pressed={sel} onClick={() => onPickZone(z.id)}>
                <span className={`zrow__chip lvl-${z.score.level}`} />
                <span className="zrow__name">{z.name}<small>{z.kind === 'gcc' ? `Zone ${z.number}` : 'Suburb'}</small></span>
                <span className="zrow__bar bar" style={{ ['--bar' as string]: `var(--lvl-${z.score.level.toLowerCase()})` }}><i style={{ width: `${Math.round(z.score.overall)}%` }} /></span>
                <b className="num">{Math.round(z.score.overall)}</b>
              </button>
            </li>
          );
        })}
        {shown.length === 0 && <li className="muted pop__none">No area matches "{q}".</li>}
      </ul>
    </>
  );
}

/** What the map shows, and what the colours mean. */
export function LayersPanel({ layers, onChange }: { layers: LayerToggles; onChange: (next: LayerToggles) => void }) {
  const { state } = useStore();
  const counts = state?.network.state;
  return (
    <div className="pop__body">
      {LAYER_LABEL.map(([k, label]) => (
        <label key={k} className="switch">
          <input type="checkbox" checked={layers[k]} onChange={(e) => onChange({ ...layers, [k]: e.target.checked })} />
          <i />
          <span>{label}{k === 'roads' && counts && (counts.blocked + counts.slow > 0) ? <em className="muted num"> {counts.blocked} closed, {counts.slow} slow</em> : null}</span>
        </label>
      ))}
      <div className="legend" aria-label="Risk colours">
        {(['Low', 'Elevated', 'High', 'Severe'] as const).map((l) => <span key={l}><i style={{ background: `var(--lvl-${l.toLowerCase()})` }} />{l}</span>)}
      </div>
    </div>
  );
}
