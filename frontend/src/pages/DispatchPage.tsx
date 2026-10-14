import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play, RotateCcw, Truck as TruckIcon, ListChecks, Sparkles, TriangleAlert } from 'lucide-react';
import { api } from '../api';
import { useStore } from '../store';
import CityMap, { type CityMapFocus } from '../map/CityMap';
import RoadDataNotice from '../components/RoadDataNotice';
import TruckTimeline from '../components/TruckTimeline';
import { DEFAULT_SETTINGS, MissionCard, NothingToDispatch, PlanningNow, ReadyToPlan, planOptions, type PlanSettingsValue } from '../components/DispatchSummary';
import type { AStarResult, Bundle, LayerToggles, Plan, Selection, Severity } from '../types';
import { RES_KEYS, RES_LABEL, fmt, fmtClock, fmtDuration, sumBundle } from '../lib/format';
import { SEVERITY_ORDER, addHours, indexPlan, truckPosition } from '../lib/plan';
import { bboxOf, type LngLat } from '../lib/geo';
import type { Scene } from '../map/overlay';

type Tab = 'areas' | 'trucks' | 'explain';
interface ExplainState { result: AStarResult; upto: number; playing: boolean }

const DISPATCH_LAYERS: LayerToggles = { risk: true, floods: true, depots: true, needs: true, roads: true };

export default function DispatchPage() {
  const { state, plan, planChecked, planPinned, busy, generatePlan, selectedTruck, selectTruck } = useStore();
  const [tab, setTab] = useState<Tab>('areas');
  const [explain, setExplain] = useState<ExplainState | null>(null);
  const [focus, setFocus] = useState<CityMapFocus | null>(null);
  const [settings, setSettings] = useState<PlanSettingsValue>(DEFAULT_SETTINGS);
  const [tried, setTried] = useState('');

  const flagged = state?.affected_areas.length ?? 0;
  // with nothing flagged an old plan would only mislead, unless it was opened on purpose from Reports
  const shown = plan && (flagged > 0 || planPinned) ? plan : null;
  const idx = useMemo(() => indexPlan(shown), [shown]);
  const planning = busy === 'plan';
  const stale = !!plan && !!state && plan.scenario_name !== state.scenario.name;
  const key = state ? `${state.hazard.scenario_key}|${flagged}` : '';

  const makePlan = useCallback(() => generatePlan(planOptions(settings, flagged)), [generatePlan, settings, flagged]);

  // Nobody should have to press a button to see the plan: make one as soon as there is something to send.
  // A plan opened on purpose from Reports is left alone.
  useEffect(() => {
    if (!state || !planChecked || busy || flagged === 0 || tried === key) return;
    if (plan && !(stale && !planPinned)) return;
    setTried(key);
    generatePlan(planOptions(settings, flagged));
  }, [state, planChecked, busy, flagged, tried, key, plan, stale, planPinned, generatePlan, settings]);

  // show every route when a new plan arrives
  const planId = shown?.plan_id;
  useEffect(() => {
    if (!idx.length) return;
    setFocus({ nonce: Date.now(), bbox: bboxOf(idx.flatMap((r) => r.path)) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId]);

  const chooseTruck = useCallback((id: string | null) => {
    selectTruck(id);
    if (!id) return;
    const r = idx.find((x) => x.truck.truck_id === id);
    if (r) setFocus({ nonce: Date.now(), bbox: bboxOf(r.path) });
  }, [idx, selectTruck]);

  // clicking a marker on the map selects the truck that serves it
  const onMapSelect = useCallback((s: Selection | null) => {
    if (!s || !shown) return;
    if (s.kind === 'area') {
      const tp = shown.truck_plans.find((t) => t.stops_detail.some((x) => x.location_id === s.id));
      if (tp) { setTab('trucks'); chooseTruck(tp.truck_id); }
    } else if (s.kind === 'depot') {
      const tp = shown.truck_plans.find((t) => t.warehouse_id === s.id);
      if (tp) { setTab('trucks'); chooseTruck(tp.truck_id); }
    }
  }, [shown, chooseTruck]);

  // choosing an area in the list: show its truck's route and fly to it, but stay in the list
  const pickArea = useCallback((truckId: string, lng: number, lat: number) => {
    selectTruck(truckId);
    setFocus({ nonce: Date.now(), center: [lng, lat], zoom: 13.6 });
  }, [selectTruck]);

  if (!state) return null;
  const needsPlan = flagged > 0 && !plan;
  const showReady = needsPlan && !planning && busy !== 'scenario' && tried === key;
  return (
    <div className="page dispatch">
      <aside className="dpanel">
        {flagged === 0 && <NothingToDispatch hasPlan={!!shown} />}
        {needsPlan && (showReady
          ? <ReadyToPlan flagged={flagged} busy={planning} settings={settings} onSettings={setSettings} onPlan={makePlan} />
          : <PlanningNow areas={flagged} />)}
        {shown && (
          <>
            <MissionCard plan={shown} planning={planning} settings={settings} onSettings={setSettings} onReplan={makePlan} />
            <PlanBody plan={shown} tab={tab} setTab={setTab} selectedTruck={selectedTruck} chooseTruck={chooseTruck}
              explain={explain} setExplain={setExplain} pickArea={pickArea} />
          </>
        )}
        <div className="dpanel__foot"><RoadDataNotice compact slim={!!shown} /></div>
      </aside>
      <div className="mapwrap">
        <DispatchMap plan={shown} idx={idx} selectedTruck={selectedTruck} explain={tab === 'explain' ? explain : null} focus={focus} onSelect={onMapSelect}
          hint={flagged > 0 && !plan && !planning} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------- tabs
function PlanBody({ plan, tab, setTab, selectedTruck, chooseTruck, explain, setExplain, pickArea }: {
  plan: Plan; tab: Tab; setTab: (t: Tab) => void; selectedTruck: string | null; chooseTruck: (id: string | null) => void;
  explain: ExplainState | null; setExplain: (e: ExplainState | null) => void; pickArea: (truckId: string, lng: number, lat: number) => void;
}) {
  return (
    <>
      <div className="dpanel__tabbar"><div className="dpanel__tabs segmented" role="tablist">
        <button role="tab" aria-selected={tab === 'areas'} onClick={() => setTab('areas')}><ListChecks size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} />Areas</button>
        <button role="tab" aria-selected={tab === 'trucks'} onClick={() => setTab('trucks')}><TruckIcon size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} />Trucks</button>
        <button role="tab" aria-selected={tab === 'explain'} onClick={() => setTab('explain')}><Sparkles size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} />Explain a route</button>
      </div></div>
      <div className="dpanel__body">
        {tab === 'areas' && <AreasTab plan={plan} pickArea={pickArea} openTruck={(id) => { setTab('trucks'); chooseTruck(id); }} />}
        {tab === 'trucks' && <TrucksTab plan={plan} selectedTruck={selectedTruck} chooseTruck={chooseTruck} />}
        {tab === 'explain' && <ExplainTab plan={plan} explain={explain} setExplain={setExplain} selectedTruck={selectedTruck} />}
      </div>
    </>
  );
}

function TrucksTab({ plan, selectedTruck, chooseTruck }: { plan: Plan; selectedTruck: string | null; chooseTruck: (id: string | null) => void }) {
  const sorted = useMemo(() => [...plan.truck_plans].sort((a, b) => (a.stops_detail[0]?.eta_hours ?? 99) - (b.stops_detail[0]?.eta_hours ?? 99)), [plan]);
  const ref = useRef<HTMLLIElement | null>(null);
  useEffect(() => { ref.current?.scrollIntoView({ block: 'nearest' }); }, [selectedTruck]);
  return (
    <ul className="trucks">
      {sorted.map((t) => {
        const open = t.truck_id === selectedTruck;
        return (
          <li key={t.truck_id} ref={open ? ref : undefined} className={open ? 'is-open' : ''}>
            <button className="trow" aria-expanded={open} onClick={() => chooseTruck(open ? null : t.truck_id)}>
              <span className="trow__no">{t.truck_number}</span>
              <span className="trow__sub">{t.warehouse_name.replace(/\s*[-–]\s*.*$/, '')} · {t.stops_detail.length} stop{t.stops_detail.length === 1 ? '' : 's'}</span>
              <span className="trow__time num">{fmtClock(t.depart_clock)} to {fmtClock(t.return_clock)}</span>
              <span className="bar trow__load" title={`Carrying ${fmt(t.capacity_utilization_pct)}% of capacity`}><i style={{ width: `${Math.min(100, t.capacity_utilization_pct)}%` }} /></span>
            </button>
            {open && (
              <div className="trow__detail">
                <dl className="kv" style={{ marginBottom: 10 }}>
                  <dt>Distance</dt><dd>{fmt(t.distance_km, 1)} km</dd>
                  <dt>Time on the road</dt><dd>{fmtDuration(t.total_hours)}</dd>
                  <dt>Load</dt><dd>{fmt(t.total_load_units)} of {fmt(t.capacity_limit)} items</dd>
                  <dt>Fuel</dt><dd>{fmt(t.fuel_usage_liters, 1)} L</dd>
                </dl>
                <TruckTimeline plan={plan} truck={t} />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Every area in the plan, worst first: when help arrives, which truck brings it, and how much of the need it covers. */
function AreasTab({ plan, pickArea, openTruck }: { plan: Plan; pickArea: (truckId: string, lng: number, lat: number) => void; openTruck: (truckId: string) => void }) {
  const { state } = useStore();
  const [openId, setOpenId] = useState<string | null>(null);
  const areaById = useMemo(() => new Map((state?.affected_areas ?? []).map((a) => [a.id, a])), [state]);
  const rows = useMemo(() => {
    type Row = { id: string; name: string; sev: Severity; eta: number; trucks: { id: string; no: string; eta: number }[]; got: Bundle; people: number };
    const by = new Map<string, Row>();
    for (const t of plan.truck_plans) {
      for (const s of t.stops_detail) {
        const r = by.get(s.location_id) ?? { id: s.location_id, name: s.location_name, sev: s.severity, eta: s.eta_hours, trucks: [], got: { food: 0, water: 0, medicine: 0, blankets: 0, emergency_kits: 0 }, people: s.people_affected };
        r.eta = Math.min(r.eta, s.eta_hours);
        r.trucks.push({ id: t.truck_id, no: t.truck_number, eta: s.eta_hours });
        for (const k of RES_KEYS) r.got[k] += s.delivered[k] ?? 0;
        by.set(s.location_id, r);
      }
    }
    for (const r of by.values()) r.trucks.sort((a, b) => a.eta - b.eta);
    const groups = SEVERITY_ORDER.map((sev) => ({ sev, items: [...by.values()].filter((r) => r.sev === sev).sort((a, b) => a.eta - b.eta) })).filter((g) => g.items.length);
    const missing = (state?.affected_areas ?? []).filter((a) => !by.has(a.id)).sort((a, b) => b.risk_score - a.risk_score);
    return { groups, missing };
  }, [plan, state]);

  return (
    <div>
      {rows.groups.map((g) => (
        <section key={g.sev} className="agroup">
          <h3 className="agroup__head"><i className={`dot sev-${g.sev}`} />{g.sev}<span className="muted num">{g.items.length} area{g.items.length === 1 ? '' : 's'}, all reached by {fmtClock(addHours(plan.plan_start, Math.max(...g.items.map((r) => r.eta))))}</span></h3>
          <ul className="arows">
            {g.items.map((r) => {
              const a = areaById.get(r.id);
              const need = a ? sumBundle(a.demands) : 0;
              const pct = need > 0 ? Math.round((100 * sumBundle(r.got)) / need) : 100;
              const open = openId === r.id;
              return (
                <li key={r.id} className={open ? 'is-open' : ''}>
                  <button className="arow" aria-expanded={open} onClick={() => { setOpenId(open ? null : r.id); if (!open && a) pickArea(r.trucks[0].id, a.lng, a.lat); }}>
                    <span className="arow__name">{r.name}</span>
                    <b className="arow__time num">{fmtClock(addHours(plan.plan_start, r.eta))}</b>
                    <span className="arow__sub">
                      Truck {r.trucks[0].no.replace('TN-RL-', '#')}{r.trucks.length > 1 ? ` and ${r.trucks.length - 1} more` : ''}
                      {' · '}
                      <span className={pct < 98 ? 'arow__part' : ''}>{pct < 98 ? `gets ${pct}% of its need` : 'full need met'}</span>
                    </span>
                    <small className="arow__in num">in {fmtDuration(r.eta)}</small>
                  </button>
                  {open && (
                    <div className="arow__detail">
                      <p className="muted">{fmt(r.people)} people{a?.reason ? ` · ${a.reason}` : ''}</p>
                      <ul className="supply">
                        {RES_KEYS.map((k) => {
                          const want = a?.demands[k] ?? 0;
                          if (want <= 0 && r.got[k] <= 0) return null;
                          const share = want > 0 ? Math.min(100, Math.round((100 * r.got[k]) / want)) : 100;
                          return (
                            <li key={k}>
                              <span>{RES_LABEL[k]}</span>
                              <span className="bar" style={{ ['--bar' as string]: share < 98 ? 'var(--lvl-high)' : 'var(--lvl-low)' }}><i style={{ width: `${share}%` }} /></span>
                              <span className="num">{fmt(r.got[k])}<small className="muted"> of {fmt(want)}</small></span>
                            </li>
                          );
                        })}
                      </ul>
                      <div className="arow__trucks">
                        {r.trucks.map((t) => (
                          <button key={t.id} className="btn btn--sm" onClick={() => openTruck(t.id)}>
                            <TruckIcon size={13} />{t.no.replace('TN-RL-', '#')} · {fmtClock(addHours(plan.plan_start, t.eta))}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      {rows.missing.length > 0 && (
        <section className="agroup">
          <h3 className="agroup__head">Not in this plan<span className="muted num">{rows.missing.length} area{rows.missing.length === 1 ? '' : 's'}</span></h3>
          <p className="muted" style={{ fontSize: 'var(--fs-sm)', margin: '0 0 6px 8px' }}>Plans cover the most severe areas first. Open “Adjust the plan” and raise the number of areas to include more.</p>
          <ul className="rows">{rows.missing.slice(0, 12).map((a) => <li key={a.id}><span className={`dot sev-${a.severity}`} /><span className="rows__name">{a.name}</span><span className="num muted">{fmt(a.people_affected)}</span></li>)}</ul>
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------- A* explainer
function ExplainTab({ plan, explain, setExplain, selectedTruck }: { plan: Plan; explain: ExplainState | null; setExplain: (e: ExplainState | null) => void; selectedTruck: string | null }) {
  const { state, toast } = useStore();
  const truck = plan.truck_plans.find((t) => t.truck_id === selectedTruck) ?? plan.truck_plans[0];
  const [from, setFrom] = useState(truck?.warehouse_id ?? '');
  const [to, setTo] = useState(truck?.stops_detail[0]?.location_id ?? '');
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (truck) { setFrom(truck.warehouse_id); setTo(truck.stops_detail[0]?.location_id ?? ''); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTruck]);

  const run = async () => {
    if (!from || !to) return;
    setLoading(true);
    try {
      const r = await api.astar(from, to);
      setExplain({ result: r, upto: 0, playing: r.found });
    } catch (e) { toast(e instanceof Error ? e.message : 'Could not trace that route', 'error'); }
    finally { setLoading(false); }
  };

  // playback clock
  useEffect(() => {
    if (!explain?.playing) return;
    let raf = 0;
    let last = performance.now();
    const n = explain.result.trace.length;
    const perSec = Math.max(8, n / 7);
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setExplain({ ...explain, upto: Math.min(n, explain.upto + perSec * dt), playing: explain.upto + perSec * dt < n });
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [explain, setExplain]);

  const r = explain?.result;
  const n = r?.trace.length ?? 0;
  const step = r && explain ? r.trace[Math.max(0, Math.min(n - 1, Math.floor(explain.upto) - 1))] : null;
  const done = !!explain && explain.upto >= n;
  const areaNames = state?.affected_areas ?? [];

  return (
    <div className="explain">
      <p className="muted" style={{ marginBottom: 12 }}>
        Watch how A* finds the fastest open road. It always checks the junction with the lowest <i>time so far + straight-line time to go</i>,
        so it heads toward the destination and detours around closed or slow roads.
      </p>
      <label className="field"><span>From depot</span>
        <select className="select" value={from} onChange={(e) => setFrom(e.target.value)}>
          {(state?.warehouses ?? []).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      </label>
      <label className="field" style={{ marginTop: 8 }}><span>To area</span>
        <select className="select" value={to} onChange={(e) => setTo(e.target.value)}>
          {areaNames.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </label>
      <button className="btn btn--primary btn--block" style={{ marginTop: 12 }} onClick={run} disabled={loading || !from || !to}>
        {loading ? <span className="spinner" /> : <Sparkles size={16} />}Explain this route
      </button>

      {r && explain && (
        <div className="explain__out">
          {!r.found ? <div className="notice notice--error"><TriangleAlert size={16} /><div>{r.message}</div></div> : (
            <>
              <div className="explain__ctl">
                <button className="btn btn--sm btn--icon" aria-label={explain.playing ? 'Pause' : 'Play'}
                  onClick={() => setExplain({ ...explain, playing: !explain.playing, upto: done ? 0 : explain.upto })}>
                  {explain.playing ? <Pause size={15} /> : <Play size={15} />}
                </button>
                <button className="btn btn--sm btn--icon" aria-label="Restart" onClick={() => setExplain({ ...explain, upto: 0, playing: true })}><RotateCcw size={15} /></button>
                <input type="range" min={0} max={n} value={Math.floor(explain.upto)} aria-label="Step through the search"
                  onChange={(e) => setExplain({ ...explain, upto: Number(e.target.value), playing: false })} />
              </div>
              <p className="explain__step num">
                {done ? <b>{r.message}</b>
                  : step ? <>Step {Math.floor(explain.upto)} of {n}: checking a junction. Time so far <b>{fmtDuration(step[2])}</b> + straight-line estimate <b>{fmtDuration(step[3])}</b> = <b>{fmtDuration(step[2] + step[3])}</b>.
                    {' '}{fmt(step[4])} candidates waiting, {fmt(step[5])} already checked.</>
                    : 'Press play to start.'}
              </p>
              {done && (
                <dl className="kv" style={{ marginTop: 10 }}>
                  <dt>Fastest route</dt><dd>{fmt(r.total_distance_km, 1)} km, {fmtDuration(r.estimated_travel_time_hours)}</dd>
                  <dt>Junctions checked</dt><dd>{fmt(r.nodes_explored_count)} of {fmt(state?.network.nodes)}</dd>
                  <dt>Truck speed assumed</dt><dd>up to {fmt(r.vmax_kmh)} km/h</dd>
                </dl>
              )}
              <p className="muted" style={{ marginTop: 10, fontSize: 'var(--fs-xs)' }}>
                Dots are junctions A* checked: pale blue means a low total time estimate, dark blue means high. A and B on the map are the depot and the area.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------- map with time bar
function DispatchMap({ plan, idx, selectedTruck, explain, focus, onSelect, hint }: {
  plan: Plan | null; idx: ReturnType<typeof indexPlan>; selectedTruck: string | null; explain: ExplainState | null; focus: CityMapFocus | null; onSelect: (s: Selection | null) => void; hint: boolean;
}) {
  const { state } = useStore();
  const span = plan ? Math.max(plan.makespan_hours ?? plan.total_travel_time_hours, 0.05) : 1;
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(15); // plan minutes per real second
  const planId = plan?.plan_id;
  useEffect(() => { setT(0); setPlaying(false); }, [planId]);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      let finished = false;
      setT((cur) => {
        const nxt = cur + (rate / 60) * dt;
        if (nxt >= span) { finished = true; return span; }
        return nxt;
      });
      if (finished) setPlaying(false); else raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, rate, span]);

  const scene = useMemo<Partial<Scene>>(() => {
    if (explain) {
      const r = explain.result;
      const fs = r.trace.map((x) => x[2] + x[3]);
      return {
        explain: {
          trace: r.trace, upto: Math.floor(explain.upto), path: r.path_lnglat as LngLat[], start: [r.start[1], r.start[0]], goal: [r.goal[1], r.goal[0]],
          done: explain.upto >= r.trace.length, fMin: Math.min(...fs, 0), fMax: Math.max(...fs, 0.01),
        },
      };
    }
    const routes = idx.map((r) => ({ id: r.truck.truck_id, path: r.path, selected: r.truck.truck_id === selectedTruck, dim: false }));
    const trucks = idx.flatMap((r) => {
      const pos = truckPosition(r, t);
      return pos ? [{ id: r.truck.truck_id, label: r.truck.truck_number.replace('TN-RL-', '#'), pos, selected: r.truck.truck_id === selectedTruck }] : [];
    });
    const sel = idx.find((r) => r.truck.truck_id === selectedTruck);
    const areas = new Map((state?.affected_areas ?? []).map((a) => [a.id, a]));
    const stops = sel
      ? sel.truck.stops_detail.flatMap((s, i) => {
          const a = areas.get(s.location_id);
          return a ? [{ pos: [a.lng, a.lat] as LngLat, n: i + 1, severity: s.severity, label: fmtClock(addHours(plan?.plan_start, s.eta_hours)) }] : [];
        })
      : [];
    return { routes, trucks, stops };
  }, [idx, selectedTruck, t, explain, state, plan]);

  const clock = fmtClock(addHours(plan?.plan_start, t));
  const done = plan ? plan.truck_plans.reduce((s, tp) => s + tp.stops_detail.filter((x) => x.eta_hours <= t).length, 0) : 0;
  const totalStops = plan ? plan.truck_plans.reduce((s, tp) => s + tp.stops_detail.length, 0) : 0;
  const moving = idx.filter((r) => truckPosition(r, t) && t > 0 && t < r.truck.total_hours).length;

  return (
    <CityMap layers={DISPATCH_LAYERS} riskMode="faint" selection={null} onSelect={onSelect} scene={scene} focus={focus}
      padding={{ top: 70, bottom: 120, left: 40, right: 60 }}>
      {hint && (
        <div className="mapnote"><b>Routes appear here</b><span>Plan the truck runs to see every truck’s route and when it reaches each area.</span></div>
      )}
      {plan && !explain && (
        <div className="timebar" role="group" aria-label="Plan playback">
          <button className="btn btn--primary btn--icon" onClick={() => { if (t >= span) setT(0); setPlaying((p) => !p); }} aria-label={playing ? 'Pause' : 'Play the plan'}>
            {playing ? <Pause size={16} /> : <Play size={16} />}
          </button>
          <div className="timebar__main">
            <input type="range" min={0} max={span} step={span / 400} value={t} aria-label="Time since dispatch"
              onChange={(e) => { setPlaying(false); setT(Number(e.target.value)); }} />
            <div className="timebar__ticks num"><span>{fmtClock(plan.plan_start)}</span><span>{fmtClock(addHours(plan.plan_start, span))}</span></div>
          </div>
          <div className="timebar__read">
            <b className="num">{clock}</b>
            <span className="num muted">{moving} on the road · {done} of {totalStops} deliveries made</span>
          </div>
          <select className="select timebar__rate" value={rate} onChange={(e) => setRate(Number(e.target.value))} aria-label="Playback speed">
            <option value={6}>Slow</option><option value={15}>Normal</option><option value={40}>Fast</option>
          </select>
        </div>
      )}
    </CityMap>
  );
}
