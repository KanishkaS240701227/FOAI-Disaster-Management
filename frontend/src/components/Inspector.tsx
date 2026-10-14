import { Eye, MapPin, X } from 'lucide-react';
import { api } from '../api';
import { useStore } from '../store';
import type { Selection } from '../types';
import { RES_KEYS, RES_LABEL, fmt, fmtClock, fmtDuration, fmtPeople, peopleSupported, scoreLevel, sumBundle } from '../lib/format';
import { haversineKm } from '../lib/geo';
import { mapsUrl, streetViewUrl } from '../lib/photos';
import PlacePhotos from './PlacePhotos';

const SCALE_NAME = { L: 'Large depot', M: 'Medium depot', S: 'Small depot' } as const;

function PlaceLinks({ lat, lng }: { lat: number; lng: number }) {
  return (
    <div className="insp__links">
      <a className="btn btn--sm" href={mapsUrl(lat, lng)} target="_blank" rel="noreferrer"><MapPin size={14} />Google Maps</a>
      <a className="btn btn--sm" href={streetViewUrl(lat, lng)} target="_blank" rel="noreferrer"><Eye size={14} />Street view</a>
    </div>
  );
}

function Score({ label, value }: { label: string; value: number }) {
  const lvl = scoreLevel(value);
  return (
    <div className="score">
      <span>{label}</span>
      <div className="bar" style={{ ['--bar' as string]: `var(--lvl-${lvl.toLowerCase()})` }}><i style={{ width: `${Math.round(value)}%` }} /></div>
      <b className="num">{Math.round(value)}</b>
    </div>
  );
}

function ZoneView({ id }: { id: string }) {
  const { zones, state, zoneName } = useStore();
  const f = zones?.features.find((x) => String(x.properties.id) === id);
  const sc = state?.hazard.zones[id];
  if (!f || !sc || !state) return null;
  const p = f.properties as Record<string, unknown>;
  const areas = state.affected_areas.filter((a) => a.zone_id === id).sort((a, b) => b.risk_score - a.risk_score);
  const depots = state.warehouses.filter((w) => w.zone_id === id);
  const people = areas.reduce((s, a) => s + a.people_affected, 0);
  const c = p.centroid as [number, number];
  return (
    <>
      <PlacePhotos place={{ kind: 'zone', name: zoneName(id), lat: c[0], lng: c[1] }} />
      <header className="insp__head">
        <div>
          <h2>{zoneName(id)}</h2>
          <p className="muted">{p.kind === 'gcc' ? `Zone ${p.number} · Greater Chennai` : 'Suburb'} · {fmtPeople(Number(p.pop))} people · {fmt(Number(p.area_km2), 1)} km²</p>
        </div>
        <span className={`pill lvl-${sc.level}`}>{sc.level}</span>
      </header>
      <PlaceLinks lat={c[0]} lng={c[1]} />
      <section className="insp__sec">
        <h3>Risk scores</h3>
        <Score label="Overall" value={sc.overall} />
        <Score label="Flood" value={sc.flood} />
        <Score label="Wind" value={sc.wind} />
        <Score label="Earthquake" value={sc.quake} />
      </section>
      <section className="insp__sec">
        <h3>Why this score</h3>
        <ul className="why">{sc.drivers.map((d, i) => <li key={i}>{d}</li>)}</ul>
      </section>
      <section className="insp__sec">
        <h3>Needs relief ({areas.length})</h3>
        {areas.length === 0 ? <p className="muted">No area in this zone is flagged right now.</p> : (
          <>
            <p className="muted" style={{ marginBottom: 6 }}>About {fmt(people)} people affected</p>
            <ul className="rows">
              {areas.slice(0, 8).map((a) => (
                <li key={a.id}><span className={`dot sev-${a.severity}`} /><span className="rows__name">{a.name}</span><span className="num muted">{fmt(a.people_affected)}</span></li>
              ))}
            </ul>
          </>
        )}
      </section>
      {depots.length > 0 && (
        <section className="insp__sec">
          <h3>Depots here ({depots.length})</h3>
          <ul className="rows">{depots.map((d) => <li key={d.id}><span className="dot dot--depot" /><span className="rows__name">{d.name}</span><span className="num muted">{fmtPeople(peopleSupported(d.stocks))}</span></li>)}</ul>
        </section>
      )}
    </>
  );
}

function DepotView({ id }: { id: string }) {
  const { state, zoneName } = useStore();
  const d = state?.warehouses.find((w) => w.id === id);
  if (!d || !state) return null;
  const trucks = state.trucks.filter((t) => t.warehouse_id === d.id);
  const mult = d.scale === 'L' ? 4 : d.scale === 'M' ? 2 : 1;
  const base: Record<string, number> = { food: 6000, water: 1500, medicine: 420, blankets: 3000, emergency_kits: 1200 };
  const near = state.affected_areas
    .map((a) => ({ a, km: haversineKm([d.lng, d.lat], [a.lng, a.lat]) }))
    .sort((x, y) => x.km - y.km)
    .slice(0, 4);
  return (
    <>
      <PlacePhotos place={{ kind: 'depot', name: d.name, lat: d.lat, lng: d.lng }} />
      <header className="insp__head">
        <div><h2>{d.name}</h2><p className="muted">{SCALE_NAME[d.scale]} · {zoneName(d.zone_id)}</p></div>
        <span className={`pill pill--plain ${d.active ? '' : 'lvl-Elevated'}`}>{d.active ? 'In service' : 'Out of service'}</span>
      </header>
      <PlaceLinks lat={d.lat} lng={d.lng} />
      <section className="insp__sec">
        <h3>Supplies on hand</h3>
        <p className="insp__lead">Enough for about <b className="num">{fmt(peopleSupported(d.stocks))}</b> people for a day.</p>
        {RES_KEYS.map((k) => (
          <div className="score" key={k}>
            <span>{RES_LABEL[k]}</span>
            <div className="bar"><i style={{ width: `${Math.min(100, (d.stocks[k] / (base[k] * mult * 1.2)) * 100)}%` }} /></div>
            <b className="num">{fmt(d.stocks[k])}</b>
          </div>
        ))}
      </section>
      <section className="insp__sec">
        <h3>Trucks based here ({trucks.length})</h3>
        {trucks.length === 0 ? <p className="muted">No trucks are based at this depot.</p> : (
          <ul className="rows">{trucks.map((t) => (
            <li key={t.id}>
              <span className="rows__name"><b>{t.truck_number}</b> <span className="muted">{t.truck_type}</span></span>
              <span className={`pill pill--plain ${t.status === 'Available' ? 'lvl-Low' : t.status === 'Busy' ? 'lvl-High' : 'lvl-Elevated'}`}>{t.status}</span>
            </li>
          ))}</ul>
        )}
      </section>
      <section className="insp__sec">
        <h3>Closest areas needing relief</h3>
        {near.length === 0 ? <p className="muted">No area is flagged right now.</p> : (
          <ul className="rows">{near.map(({ a, km }) => (
            <li key={a.id}><span className={`dot sev-${a.severity}`} /><span className="rows__name">{a.name}</span><span className="num muted">{km < 10 ? km.toFixed(1) : Math.round(km)} km</span></li>
          ))}</ul>
        )}
        <p className="muted insp__note">Distances are in a straight line. The dispatch plan uses real roads.</p>
      </section>
      <p className="muted insp__foot">This depot's position is a representative placeholder. Edit it under Resources.</p>
    </>
  );
}

function AreaView({ id }: { id: string }) {
  const { state, plan, zoneName, selectTruck, now } = useStore();
  const a = state?.affected_areas.find((x) => x.id === id);
  if (!a || !state) return null;
  let delivery: { truck: string; truckId: string; eta: string | null; hours: number } | null = null;
  for (const tp of plan?.truck_plans ?? []) {
    const st = tp.stops_detail.find((s) => s.location_id === a.id);
    if (st && (!delivery || st.eta_hours < delivery.hours)) delivery = { truck: tp.truck_number, truckId: tp.truck_id, eta: st.eta_clock, hours: st.eta_hours };
  }
  void now;
  return (
    <>
      <PlacePhotos place={{ kind: 'area', name: a.name, lat: a.lat, lng: a.lng }} />
      <header className="insp__head">
        <div><h2>{a.name}</h2><p className="muted">{zoneName(a.zone_id)} · {a.hazard === 'manual' ? 'Added by an operator' : `${a.hazard} risk`}</p></div>
        <span className={`pill sev-${a.severity}`}>{a.severity}</span>
      </header>
      <PlaceLinks lat={a.lat} lng={a.lng} />
      <section className="insp__sec">
        <dl className="kv">
          <dt>People affected</dt><dd>{fmt(a.people_affected)}</dd>
          <dt>Population of the area</dt><dd>{fmt(a.population)}</dd>
          <dt>Risk score</dt><dd>{Math.round(a.risk_score)} / 100</dd>
        </dl>
      </section>
      {a.reason && <section className="insp__sec"><h3>Why it is flagged</h3><p>{a.reason}</p></section>}
      <section className="insp__sec">
        <h3>Relief requested</h3>
        {RES_KEYS.map((k) => <div className="score score--plain" key={k}><span>{RES_LABEL[k]}</span><b className="num">{fmt(a.demands[k])}</b></div>)}
        <div className="score score--plain"><span><b>Total</b></span><b className="num">{fmt(sumBundle(a.demands))}</b></div>
      </section>
      <section className="insp__sec">
        <h3>Delivery</h3>
        {delivery ? (
          <>
            <p><b>{fmtClock(delivery.eta)}</b> <span className="muted">· {fmtDuration(delivery.hours)} after dispatch · truck {delivery.truck}</span></p>
            <a className="btn btn--sm" style={{ marginTop: 8 }} href="#/dispatch" onClick={() => selectTruck(delivery!.truckId)}>See the route</a>
          </>
        ) : <p className="muted">{plan ? 'This area is not in the current dispatch plan.' : 'No dispatch plan yet. Generate one under Dispatch.'}</p>}
      </section>
    </>
  );
}

function RoadView({ probe, onChange }: { probe: Extract<Selection, { kind: 'road' }>['probe']; onChange: () => void }) {
  const { toast, refresh } = useStore();
  const status = probe.status ?? 'open';
  const act = async (close: boolean) => {
    try {
      if (close) await api.blockRoad(probe.id!, 'Closed by operator'); else await api.unblockRoad(probe.id!);
      toast(close ? 'Road closed. Routes will avoid it.' : 'Road reopened');
      await refresh();
      onChange();
    } catch (e) { toast(e instanceof Error ? e.message : 'Could not change the road', 'error'); }
  };
  const auto = status === 'blocked' && !probe.manual;
  return (
    <>
      <header className="insp__head">
        <div><h2>{probe.name && probe.name !== 'Approximate link' ? probe.name : 'Road segment'}</h2><p className="muted">{probe.cls} road · {fmt(probe.km, 2)} km</p></div>
        <span className={`pill lvl-${status === 'blocked' ? 'Severe' : status === 'slow' ? 'Elevated' : 'Low'}`}>{status === 'blocked' ? 'Closed' : status === 'slow' ? 'Slow' : 'Open'}</span>
      </header>
      <section className="insp__sec">
        {probe.reason ? <p>{probe.reason}</p> : <p className="muted">Normal traffic.</p>}
        {status === 'slow' && <p className="muted" style={{ marginTop: 6 }}>Trucks travel at about {Math.round((probe.factor ?? 1) * 100)}% of normal speed here.</p>}
        {auto && <p className="muted" style={{ marginTop: 6 }}>Closed automatically because of flooding. It reopens when the flood score drops.</p>}
      </section>
      <section className="insp__sec" style={{ display: 'flex', gap: 8 }}>
        {status !== 'blocked' && <button className="btn btn--danger" onClick={() => act(true)}>Close this road</button>}
        {status === 'blocked' && probe.manual && <button className="btn" onClick={() => act(false)}>Reopen road</button>}
      </section>
      <p className="muted insp__foot">Closing a road changes routes in the next dispatch plan.</p>
    </>
  );
}

export default function Inspector({ selection, onClose, onRoadChanged }: { selection: Selection; onClose: () => void; onRoadChanged: () => void }) {
  return (
    <aside className="insp" aria-label="Details">
      <button className="insp__close" onClick={onClose} aria-label="Close details"><X size={16} /></button>
      <div className="insp__scroll">
        {selection.kind === 'zone' && <ZoneView id={selection.id} />}
        {selection.kind === 'depot' && <DepotView id={selection.id} />}
        {selection.kind === 'area' && <AreaView id={selection.id} />}
        {selection.kind === 'road' && <RoadView probe={selection.probe} onChange={onRoadChanged} />}
      </div>
    </aside>
  );
}
