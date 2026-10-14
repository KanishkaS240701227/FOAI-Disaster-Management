import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { api } from '../api';
import { useStore } from '../store';
import Modal from '../components/Modal';
import RoadDataNotice from '../components/RoadDataNotice';
import type { AffectedArea, FC, Severity, Truck, Warehouse } from '../types';
import { PER_PERSON, RES_KEYS, RES_LABEL, fmt, fmtPeople, peopleSupported } from '../lib/format';
import { pointInGeometry } from '../lib/geo';

type Tab = 'depots' | 'fleet' | 'needs' | 'roads';
const TABS: { id: Tab; label: string }[] = [
  { id: 'depots', label: 'Depots' }, { id: 'fleet', label: 'Fleet' }, { id: 'needs', label: 'Areas needing relief' }, { id: 'roads', label: 'Roads' },
];

function useCityCheck() {
  const { outline } = useStore();
  return (lat: number, lng: number) => !outline || pointInGeometry([lng, lat], outline.geometry);
}

export default function ResourcesPage() {
  const [tab, setTab] = useState<Tab>('depots');
  const { state } = useStore();
  if (!state) return null;
  const counts: Record<Tab, number> = {
    depots: state.warehouses.length, fleet: state.trucks.length, needs: state.affected_areas.length,
    roads: state.network.state.blocked + state.network.state.slow,
  };
  return (
    <div className="page page--scroll">
      <div className="resources">
        <div className="resources__bar">
          <div className="segmented" role="tablist">
            {TABS.map((t) => (
              <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>{t.label} <span className="muted num">{counts[t.id]}</span></button>
            ))}
          </div>
        </div>
        {tab === 'depots' && <Depots />}
        {tab === 'fleet' && <Fleet />}
        {tab === 'needs' && <Needs />}
        {tab === 'roads' && <Roads />}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ helpers
function Num({ label, value, onChange, min = 0, step = 1 }: { label: string; value: number; onChange: (n: number) => void; min?: number; step?: number }) {
  return (
    <label className="field"><span>{label}</span>
      <input className="input input--num" type="number" min={min} step={step} value={Number.isFinite(value) ? value : ''} onChange={(e) => onChange(Number(e.target.value))} required />
    </label>
  );
}

async function run(action: () => Promise<unknown>, ok: string, store: ReturnType<typeof useStore>, after?: () => void) {
  try { await action(); store.toast(ok); await store.refresh(); after?.(); }
  catch (e) { store.toast(e instanceof Error ? e.message : 'That did not work', 'error'); }
}

// ------------------------------------------------------------------ depots
function Depots() {
  const store = useStore();
  const { state, zoneName } = store;
  const [edit, setEdit] = useState<Partial<Warehouse> | null>(null);
  if (!state) return null;
  return (
    <section>
      <div className="resources__head">
        <p className="muted">Depots hold the relief stock and the trucks. Positions are representative until you enter your real depot addresses.</p>
        <button className="btn btn--primary" onClick={() => setEdit({ name: '', lat: 13.05, lng: 80.2, scale: 'M', active: true, stocks: { food: 12000, water: 3000, medicine: 840, blankets: 6000, emergency_kits: 2400 } })}><Plus size={16} />Add depot</button>
      </div>
      <div className="tablewrap">
        <table className="rtable">
          <thead><tr><th>Depot</th><th>Zone</th><th>Size</th><th className="r">Supplies for</th><th className="r">Trucks</th><th>Status</th><th /></tr></thead>
          <tbody>
            {state.warehouses.map((w) => (
              <tr key={w.id}>
                <td><b>{w.name}</b></td>
                <td>{zoneName(w.zone_id)}</td>
                <td>{w.scale === 'L' ? 'Large' : w.scale === 'M' ? 'Medium' : 'Small'}</td>
                <td className="r num">{fmtPeople(peopleSupported(w.stocks))} people</td>
                <td className="r num">{state.trucks.filter((t) => t.warehouse_id === w.id).length}</td>
                <td><span className={`pill ${w.active ? 'lvl-Low' : 'lvl-Elevated'}`}>{w.active ? 'In service' : 'Out of service'}</span></td>
                <td className="r actions">
                  <button className="btn btn--quiet btn--icon btn--sm" aria-label={`Edit ${w.name}`} onClick={() => setEdit(w)}><Pencil size={15} /></button>
                  <button className="btn btn--quiet btn--icon btn--sm" aria-label={`Delete ${w.name}`}
                    onClick={() => { if (confirm(`Delete ${w.name}? Trucks based there are removed too.`)) run(() => api.deleteWarehouse(w.id), 'Depot deleted', store); }}><Trash2 size={15} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {edit && <DepotForm initial={edit} onClose={() => setEdit(null)} />}
    </section>
  );
}

function DepotForm({ initial, onClose }: { initial: Partial<Warehouse>; onClose: () => void }) {
  const store = useStore();
  const inCity = useCityCheck();
  const [f, setF] = useState({
    name: initial.name ?? '', lat: initial.lat ?? 13.05, lng: initial.lng ?? 80.2, scale: initial.scale ?? 'M', active: initial.active ?? true,
    stocks: { food: 0, water: 0, medicine: 0, blankets: 0, emergency_kits: 0, ...(initial.stocks ?? {}) },
  });
  const outside = !inCity(f.lat, f.lng);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (outside) return;
    const body = {
      name: f.name.trim(), latitude: f.lat, longitude: f.lng, scale: f.scale, active: f.active,
      food_stock: f.stocks.food, water_stock: f.stocks.water, medicine_stock: f.stocks.medicine, blanket_stock: f.stocks.blankets, emergency_kit_stock: f.stocks.emergency_kits,
    };
    await run(() => (initial.id ? api.updateWarehouse(initial.id, body) : api.createWarehouse(body)), initial.id ? 'Depot saved' : 'Depot added', store, onClose);
  };
  return (
    <Modal title={initial.id ? 'Edit depot' : 'Add depot'} onClose={onClose}
      footer={<><button className="btn" onClick={onClose} type="button">Cancel</button><button className="btn btn--primary" form="depot-form" disabled={outside}>{initial.id ? 'Save depot' : 'Add depot'}</button></>}>
      <form id="depot-form" className="form" onSubmit={submit}>
        <label className="field"><span>Name</span><input className="input" required minLength={2} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
        <div className="form__row">
          <Num label="Latitude" value={f.lat} step={0.0001} min={12.8} onChange={(n) => setF({ ...f, lat: n })} />
          <Num label="Longitude" value={f.lng} step={0.0001} min={80} onChange={(n) => setF({ ...f, lng: n })} />
        </div>
        {outside && <div className="notice notice--error">This point is outside Chennai and its suburbs. Latitude should be about 12.85 to 13.23 and longitude about 80.05 to 80.33.</div>}
        <div className="form__row">
          <label className="field"><span>Size</span>
            <select className="select" value={f.scale} onChange={(e) => setF({ ...f, scale: e.target.value as 'S' | 'M' | 'L' })}>
              <option value="S">Small</option><option value="M">Medium</option><option value="L">Large</option>
            </select>
          </label>
          <label className="field"><span>Status</span>
            <select className="select" value={f.active ? 'y' : 'n'} onChange={(e) => setF({ ...f, active: e.target.value === 'y' })}>
              <option value="y">In service</option><option value="n">Out of service</option>
            </select>
          </label>
        </div>
        <fieldset className="form__set"><legend>Stock on hand</legend>
          <div className="form__grid">
            {RES_KEYS.map((k) => <Num key={k} label={RES_LABEL[k]} value={f.stocks[k]} onChange={(n) => setF({ ...f, stocks: { ...f.stocks, [k]: n } })} />)}
          </div>
        </fieldset>
      </form>
    </Modal>
  );
}

// ------------------------------------------------------------------ fleet
function Fleet() {
  const store = useStore();
  const { state } = store;
  const [edit, setEdit] = useState<Partial<Truck> | null>(null);
  const [depot, setDepot] = useState('all');
  if (!state) return null;
  const names = new Map(state.warehouses.map((w) => [w.id, w.name]));
  const rows = state.trucks.filter((t) => depot === 'all' || t.warehouse_id === depot);
  return (
    <section>
      <div className="resources__head">
        <select className="select" style={{ maxWidth: 280 }} value={depot} onChange={(e) => setDepot(e.target.value)} aria-label="Filter by depot">
          <option value="all">All depots</option>
          {state.warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
        <button className="btn btn--primary" onClick={() => setEdit({ truck_number: '', truck_type: 'Light truck (4 t)', capacity: 2500, fuel_capacity: 100, average_speed: 36, fuel_consumption: 0.2, warehouse_id: state.warehouses[0]?.id, status: 'Available' })}><Plus size={16} />Add truck</button>
      </div>
      <div className="tablewrap">
        <table className="rtable">
          <thead><tr><th>Truck</th><th>Type</th><th>Based at</th><th className="r">Carries</th><th className="r">Speed</th><th>Status</th><th /></tr></thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id}>
                <td><b>{t.truck_number}</b></td><td>{t.truck_type}</td><td>{names.get(t.warehouse_id) ?? '–'}</td>
                <td className="r num">{fmt(t.capacity)} items</td><td className="r num">{fmt(t.average_speed)} km/h</td>
                <td><span className={`pill ${t.status === 'Available' ? 'lvl-Low' : t.status === 'Busy' ? 'lvl-Elevated' : 'lvl-Severe'}`}>{t.status === 'In Maintenance' ? 'In repair' : t.status}</span></td>
                <td className="r actions">
                  <button className="btn btn--quiet btn--icon btn--sm" aria-label={`Edit ${t.truck_number}`} onClick={() => setEdit(t)}><Pencil size={15} /></button>
                  <button className="btn btn--quiet btn--icon btn--sm" aria-label={`Delete ${t.truck_number}`}
                    onClick={() => { if (confirm(`Delete truck ${t.truck_number}?`)) run(() => api.deleteTruck(t.id), 'Truck deleted', store); }}><Trash2 size={15} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {edit && <TruckForm initial={edit} onClose={() => setEdit(null)} />}
    </section>
  );
}

function TruckForm({ initial, onClose }: { initial: Partial<Truck>; onClose: () => void }) {
  const store = useStore();
  const { state } = store;
  const [f, setF] = useState({
    truck_number: initial.truck_number ?? '', truck_type: initial.truck_type ?? 'Light truck (4 t)', capacity: initial.capacity ?? 2500, fuel_capacity: initial.fuel_capacity ?? 100,
    average_speed: initial.average_speed ?? 36, fuel_consumption: initial.fuel_consumption ?? 0.2, current_warehouse_id: initial.warehouse_id ?? state?.warehouses[0]?.id ?? '', status: initial.status ?? 'Available',
  });
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    await run(() => (initial.id ? api.updateTruck(initial.id, f) : api.createTruck(f)), initial.id ? 'Truck saved' : 'Truck added', store, onClose);
  };
  return (
    <Modal title={initial.id ? 'Edit truck' : 'Add truck'} onClose={onClose}
      footer={<><button className="btn" onClick={onClose} type="button">Cancel</button><button className="btn btn--primary" form="truck-form">{initial.id ? 'Save truck' : 'Add truck'}</button></>}>
      <form id="truck-form" className="form" onSubmit={submit}>
        <div className="form__row">
          <label className="field"><span>Registration</span><input className="input" required minLength={2} value={f.truck_number} onChange={(e) => setF({ ...f, truck_number: e.target.value })} /></label>
          <label className="field"><span>Type</span><input className="input" required value={f.truck_type} onChange={(e) => setF({ ...f, truck_type: e.target.value })} /></label>
        </div>
        <label className="field"><span>Based at</span>
          <select className="select" value={f.current_warehouse_id} onChange={(e) => setF({ ...f, current_warehouse_id: e.target.value })}>
            {(state?.warehouses ?? []).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </label>
        <div className="form__row">
          <Num label="Items it carries" value={f.capacity} min={1} onChange={(n) => setF({ ...f, capacity: n })} />
          <Num label="Fuel tank (litres)" value={f.fuel_capacity} min={1} onChange={(n) => setF({ ...f, fuel_capacity: n })} />
        </div>
        <div className="form__row">
          <Num label="Average speed (km/h)" value={f.average_speed} min={5} onChange={(n) => setF({ ...f, average_speed: n })} />
          <Num label="Fuel use (litres per km)" value={f.fuel_consumption} min={0.01} step={0.01} onChange={(n) => setF({ ...f, fuel_consumption: n })} />
        </div>
        <label className="field"><span>Status</span>
          <select className="select" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as Truck['status'] })}>
            <option value="Available">Available</option><option value="Busy">Busy</option><option value="In Maintenance">In repair</option>
          </select>
        </label>
      </form>
    </Modal>
  );
}

// ------------------------------------------------------------------ needs
const SEVS: Severity[] = ['Low', 'Medium', 'High', 'Critical'];
function Needs() {
  const store = useStore();
  const { state, zoneName } = store;
  const [edit, setEdit] = useState<Partial<AffectedArea> | null>(null);
  const [syncing, setSyncing] = useState(false);
  if (!state) return null;
  const rows = [...state.affected_areas].sort((a, b) => b.risk_score - a.risk_score);
  return (
    <section>
      <div className="resources__head">
        <p className="muted">Areas are flagged automatically from flood hotspots and wind or quake scores. Areas you add stay until you delete them.</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" disabled={syncing} onClick={async () => { setSyncing(true); await run(() => api.syncAreas(), 'Areas updated from current conditions', store); setSyncing(false); }}>
            {syncing ? <span className="spinner" /> : <RefreshCw size={15} />}Update from conditions
          </button>
          <button className="btn btn--primary" onClick={() => setEdit({ name: '', lat: 13.05, lng: 80.2, people_affected: 1000, severity: 'High', hazard: 'manual', manual: true })}><Plus size={16} />Add area</button>
        </div>
      </div>
      <div className="tablewrap">
        <table className="rtable">
          <thead><tr><th>Area</th><th>Zone</th><th>Severity</th><th className="r">People affected</th><th>Source</th><th /></tr></thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id}>
                <td><b>{a.name}</b></td><td>{zoneName(a.zone_id)}</td>
                <td><span className={`pill sev-${a.severity}`}>{a.severity}</span></td>
                <td className="r num">{fmt(a.people_affected)}</td>
                <td>{a.manual ? 'Added by you' : a.hazard === 'flood' ? 'Flood hotspot' : a.hazard === 'wind' ? 'Wind' : 'Earthquake'}</td>
                <td className="r actions">
                  <button className="btn btn--quiet btn--icon btn--sm" aria-label={`Edit ${a.name}`} onClick={() => setEdit(a)}><Pencil size={15} /></button>
                  <button className="btn btn--quiet btn--icon btn--sm" aria-label={`Delete ${a.name}`}
                    onClick={() => { if (confirm(`Remove ${a.name}?`)) run(() => api.deleteArea(a.id), 'Area removed', store); }}><Trash2 size={15} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <div className="empty" style={{ margin: 16 }}><strong>No area needs relief right now</strong>Conditions are calm. Pick a replay or drill in the top bar, or add an area yourself.</div>}
      </div>
      {edit && <AreaForm initial={edit} onClose={() => setEdit(null)} />}
    </section>
  );
}

function AreaForm({ initial, onClose }: { initial: Partial<AffectedArea>; onClose: () => void }) {
  const store = useStore();
  const inCity = useCityCheck();
  const [f, setF] = useState({ name: initial.name ?? '', lat: initial.lat ?? 13.05, lng: initial.lng ?? 80.2, people: initial.people_affected ?? 1000, severity: (initial.severity ?? 'High') as Severity, reason: initial.reason ?? '' });
  const outside = !inCity(f.lat, f.lng);
  const need = useMemo(() => Object.fromEntries(RES_KEYS.map((k) => [k, Math.round(f.people * PER_PERSON[k])])) as Record<(typeof RES_KEYS)[number], number>, [f.people]);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (outside) return;
    const demands = { food_demand: need.food, water_demand: need.water, medicine_demand: need.medicine, blanket_demand: need.blankets, emergency_kit_demand: need.emergency_kits };
    const body = { name: f.name.trim(), latitude: f.lat, longitude: f.lng, people_affected: f.people, population: Math.max(f.people, 1), severity: f.severity, reason: f.reason, ...demands };
    await run(() => (initial.id ? api.updateArea(initial.id, body) : api.createArea({ ...body, hazard: 'manual', manual: true, risk_score: { Low: 20, Medium: 45, High: 70, Critical: 90 }[f.severity] })),
      initial.id ? 'Area saved' : 'Area added', store, onClose);
  };
  return (
    <Modal title={initial.id ? 'Edit area' : 'Add area needing relief'} onClose={onClose}
      footer={<><button className="btn" onClick={onClose} type="button">Cancel</button><button className="btn btn--primary" form="area-form" disabled={outside}>{initial.id ? 'Save area' : 'Add area'}</button></>}>
      <form id="area-form" className="form" onSubmit={submit}>
        <label className="field"><span>Name</span><input className="input" required minLength={2} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
        <div className="form__row">
          <Num label="Latitude" value={f.lat} step={0.0001} min={12.8} onChange={(n) => setF({ ...f, lat: n })} />
          <Num label="Longitude" value={f.lng} step={0.0001} min={80} onChange={(n) => setF({ ...f, lng: n })} />
        </div>
        {outside && <div className="notice notice--error">This point is outside Chennai and its suburbs.</div>}
        <div className="form__row">
          <Num label="People affected" value={f.people} min={0} onChange={(n) => setF({ ...f, people: n })} />
          <label className="field"><span>Severity</span>
            <select className="select" value={f.severity} onChange={(e) => setF({ ...f, severity: e.target.value as Severity })}>{SEVS.map((s) => <option key={s}>{s}</option>)}</select>
          </label>
        </div>
        <label className="field"><span>Note (optional)</span><input className="input" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></label>
        <p className="muted" style={{ fontSize: 'var(--fs-sm)' }}>
          Relief requested is worked out from the number of people: {RES_KEYS.map((k) => `${fmt(need[k])} ${RES_LABEL[k].toLowerCase()}`).join(', ')}.
        </p>
      </form>
    </Modal>
  );
}

// ------------------------------------------------------------------ roads
function Roads() {
  const store = useStore();
  const { state } = store;
  const [overlay, setOverlay] = useState<FC | null>(null);
  const v = state?.network.version;
  useEffect(() => { api.overlay().then(setOverlay).catch(() => setOverlay(null)); }, [v]);
  if (!state) return null;
  const n = state.network;
  const manual = (overlay?.features ?? []).filter((f) => f.properties.manual);
  return (
    <section className="roads">
      <div className="roads__grid">
        <div>
          <h2>Road network</h2>
          <dl className="kv" style={{ margin: '12px 0 16px' }}>
            <dt>Map used for routing</dt><dd>{n.source === 'osm' ? 'Real roads (OpenStreetMap)' : 'Approximate network'}</dd>
            <dt>Junctions</dt><dd>{fmt(n.nodes)}</dd>
            <dt>Road segments</dt><dd>{fmt(n.edges)}</dd>
            <dt>Open</dt><dd>{fmt(n.state.open)}</dd>
            <dt>Slow (flooding or wind)</dt><dd>{fmt(n.state.slow)}</dd>
            <dt>Closed</dt><dd>{fmt(n.state.blocked)}</dd>
          </dl>
          <RoadDataNotice />
        </div>
        <div>
          <h2>Closed by you</h2>
          <p className="muted" style={{ margin: '4px 0 12px' }}>To close a road, click it on the Map screen at street zoom. Roads that flood close automatically.</p>
          {manual.length === 0 ? <div className="empty"><strong>No roads closed by hand</strong>Closures you make show up here so you can reopen them.</div> : (
            <ul className="rows">
              {manual.map((f) => (
                <li key={String(f.properties.id)}>
                  <span className="rows__name">{String(f.properties.name || 'Road segment')}<small className="muted"> · {String(f.properties.reason || 'Closed by operator')}</small></span>
                  <button className="btn btn--sm" onClick={() => run(() => api.unblockRoad(Number(f.properties.id)), 'Road reopened', store)}>Reopen</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
