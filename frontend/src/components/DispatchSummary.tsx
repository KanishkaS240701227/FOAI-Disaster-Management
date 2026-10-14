import { useMemo } from 'react';
import { Activity, CircleCheck, CloudRain, Download, PackageX, RefreshCw, Truck as TruckIcon, TriangleAlert, Wind } from 'lucide-react';
import { api } from '../api';
import { useStore, type PlanOptions } from '../store';
import type { Plan, ScenarioItem } from '../types';
import { fmt, fmtClock, fmtDuration, fmtPeople, RES_LABEL, RES_KEYS } from '../lib/format';
import { addHours, digestPlan } from '../lib/plan';

/** How hard the planner searches. Plain names; the numbers are what the genetic algorithm gets to try. */
export const EFFORT = {
  quick: { label: 'Fast', hint: 'A couple of seconds', generations: 100, population_size: 60 },
  standard: { label: 'Balanced', hint: 'About ten seconds', generations: 250, population_size: 100 },
  thorough: { label: 'Best', hint: 'Up to a minute, finds shorter runs', generations: 600, population_size: 160 },
} as const;
export interface PlanSettingsValue { effort: keyof typeof EFFORT; /** null means every flagged area */ areas: number | null }
export const DEFAULT_SETTINGS: PlanSettingsValue = { effort: 'standard', areas: null };

export function planOptions(v: PlanSettingsValue, flagged: number): PlanOptions {
  const cap = Math.max(1, Math.min(60, flagged));
  return { generations: EFFORT[v.effort].generations, population_size: EFFORT[v.effort].population_size, max_areas: Math.min(v.areas ?? cap, cap) };
}

function kindIcon(kind: string) {
  if (kind === 'earthquake') return <Activity size={16} />;
  if (kind === 'cyclone') return <Wind size={16} />;
  return <CloudRain size={16} />;
}

// ------------------------------------------------------------------------------------------ nothing to send
/** Shown when no area is flagged. Offers real events so the page is never a dead end. */
export function NothingToDispatch({ hasPlan }: { hasPlan: boolean }) {
  const { scenarios, loadScenario, busy } = useStore();
  const events = scenarios.filter((s) => s.key !== 'live');
  const switching = busy === 'scenario';
  return (
    <section className="dpanel__sec dempty">
      <span className="dempty__icon" aria-hidden="true"><CircleCheck size={22} /></span>
      <h2>Nothing needs relief right now</h2>
      <p className="muted">
        Dispatch sends trucks with food, water and medicine to areas that a storm, flood or earthquake has hit. Conditions are calm,
        so no area is flagged.{hasPlan ? ' The plan below was made for an earlier event.' : ''}
      </p>
      <h3 className="dpanel__sub">See it work on a real event</h3>
      <ul className="dscen">
        {events.map((s: ScenarioItem) => (
          <li key={s.key}>
            <button className="dscen__btn" disabled={switching} onClick={() => loadScenario(s.key)}>
              <span className={`dscen__kind dscen__kind--${s.kind}`}>{kindIcon(s.kind)}</span>
              <span className="dscen__text"><b>{s.name}</b><small>{s.description}</small></span>
            </button>
          </li>
        ))}
      </ul>
      <p className="muted dempty__foot">
        Or <a href="#/resources">add an area that needs help by hand</a> on the Resources page and it will be planned here.
      </p>
    </section>
  );
}

// ------------------------------------------------------------------------------------------ working
export function PlanningNow({ areas }: { areas: number }) {
  return (
    <section className="dpanel__sec dplanning" role="status" aria-live="polite">
      <h2>Planning the runs…</h2>
      <p className="muted">Finding the fastest open roads to {areas} area{areas === 1 ? '' : 's'} and choosing which truck goes where. This takes a few seconds.</p>
      <div className="indet" aria-hidden="true"><i /></div>
      <ul className="dplanning__steps muted">
        <li>Counting what each depot has in stock</li>
        <li>Ranking the areas, most severe first</li>
        <li>Routing trucks around closed and flooded roads</li>
      </ul>
    </section>
  );
}

/** Fallback when automatic planning did not run or failed: one clear button. */
export function ReadyToPlan({ flagged, busy, settings, onSettings, onPlan }: {
  flagged: number; busy: boolean; settings: PlanSettingsValue; onSettings: (v: PlanSettingsValue) => void; onPlan: () => void;
}) {
  const { state } = useStore();
  const people = state?.affected_areas.reduce((n, a) => n + a.people_affected, 0) ?? 0;
  return (
    <section className="dpanel__sec">
      <h2>{flagged} area{flagged === 1 ? '' : 's'} need relief</h2>
      <p className="muted">About {fmtPeople(people)} people are affected. Plan the truck runs to get supplies to them.</p>
      <button className="btn btn--primary btn--block" style={{ marginTop: 14 }} disabled={busy} onClick={onPlan}>
        {busy ? <><span className="spinner" style={{ borderTopColor: 'var(--on-accent)' }} />Planning…</> : <><TruckIcon size={16} />Plan the truck runs</>}
      </button>
      <PlanSettings flagged={flagged} value={settings} onChange={onSettings} />
    </section>
  );
}

// ------------------------------------------------------------------------------------------ settings
export function PlanSettings({ flagged, value, onChange }: { flagged: number; value: PlanSettingsValue; onChange: (v: PlanSettingsValue) => void }) {
  const cap = Math.max(1, Math.min(60, flagged));
  const n = Math.min(value.areas ?? cap, cap);
  return (
    <details className="opts dsettings">
      <summary>Adjust the plan</summary>
      <div className="field" style={{ margin: '12px 0' }}>
        <span>How long to search</span>
        <div className="segmented" role="group" aria-label="How long to search">
          {(Object.keys(EFFORT) as (keyof typeof EFFORT)[]).map((k) => (
            <button key={k} aria-pressed={value.effort === k} onClick={() => onChange({ ...value, effort: k })}>{EFFORT[k].label}</button>
          ))}
        </div>
        <small className="muted">{EFFORT[value.effort].hint}</small>
      </div>
      <label className="field">
        <span>{n >= cap ? `Cover all ${cap} areas` : `Cover the ${n} most severe of ${cap} areas`}</span>
        <input type="range" min={Math.min(6, cap)} max={cap} value={n} disabled={cap <= 6}
          onChange={(e) => { const v = Number(e.target.value); onChange({ ...value, areas: v >= cap ? null : v }); }} aria-label="Number of areas to cover" />
      </label>
    </details>
  );
}

// ------------------------------------------------------------------------------------------ the result
export function MissionCard({ plan, planning, settings, onSettings, onReplan }: {
  plan: Plan; planning: boolean; settings: PlanSettingsValue; onSettings: (v: PlanSettingsValue) => void; onReplan: () => void;
}) {
  const { state } = useStore();
  const areas = state?.affected_areas;
  const d = useMemo(() => digestPlan(plan, areas ?? []), [plan, areas]);
  const stale = !!state && plan.scenario_name !== state.scenario.name;
  const all = d.areasServed >= d.areasTotal;
  const last = addHours(plan.plan_start, d.lastHours);
  const made = plan.generated_at ?? plan.created_at;
  const warnings = plan.warnings.filter((w) => !(d.short && /could not be delivered/i.test(w)));
  const flagged = areas?.length ?? 0;

  return (
    <section className="dpanel__sec dmission">
      <p className="dmission__meta">{plan.scenario_name} · planned {fmtClock(made)}</p>
      <h2 className="dmission__title">
        {d.trucks} truck{d.trucks === 1 ? '' : 's'} reach {all ? `all ${d.areasTotal}` : `${d.areasServed} of ${d.areasTotal}`} areas by {fmtClock(last)}
      </h2>

      <dl className="dstats">
        <div>
          <dt>First delivery</dt>
          <dd className="num">{d.first ? fmtClock(addHours(plan.plan_start, d.first.hours)) : '–'}</dd>
          <small>{d.first ? `${d.first.name}, in ${fmtDuration(d.first.hours)}` : 'No deliveries'}</small>
        </div>
        <div>
          <dt>Critical areas</dt>
          <dd className="num">{d.critical ? fmtClock(addHours(plan.plan_start, d.critical.byHours)) : 'None'}</dd>
          <small>{d.critical ? (d.critical.served >= d.critical.total ? `all ${d.critical.total} reached by then` : `${d.critical.served} of ${d.critical.total} reached`) : 'No area is critical'}</small>
        </div>
        <div>
          <dt>People reached</dt>
          <dd className="num">{fmtPeople(d.peopleReached)}</dd>
          <small>of {fmtPeople(d.peopleAffected)} affected</small>
        </div>
        <div>
          <dt>Relief delivered</dt>
          <dd className="num">{fmt(plan.coverage_pct, 0)}%</dd>
          <small>of what areas need</small>
        </div>
      </dl>

      {stale && (
        <div className="notice" style={{ marginTop: 12 }}>
          <TriangleAlert size={16} />
          <div>This plan was made for “{plan.scenario_name}”, not the conditions shown now. Plan again to update it.</div>
        </div>
      )}

      {d.short && (
        <div className="notice dshort" style={{ marginTop: 12 }}>
          <PackageX size={16} />
          <div>
            <b>Not enough stock to cover everyone</b>
            <span>About {fmt(100 - plan.coverage_pct, 0)}% of what these areas asked for is short. Add stock or depots on the <a href="#/resources">Resources page</a>, then plan again.</span>
            <details className="dshort__more">
              <summary>See what is missing</summary>
              <ul className="dshort__list">
                {RES_KEYS.filter((k) => d.shortfall[k] > 0).map((k) => <li key={k}><span>{RES_LABEL[k]}</span><b className="num">{fmt(d.shortfall[k])}</b></li>)}
              </ul>
            </details>
          </div>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="notice" style={{ marginTop: 12 }}>
          <TriangleAlert size={16} />
          <div>{warnings.map((w, i) => <span key={i}>{w}</span>)}</div>
        </div>
      )}

      <div className="dactions">
        <button className="btn btn--primary" disabled={planning} onClick={onReplan}>
          {planning ? <><span className="spinner" style={{ borderTopColor: 'var(--on-accent)' }} />Planning…</> : <><RefreshCw size={15} />Plan again</>}
        </button>
        <a className="btn" href={api.pdfUrl(plan.plan_id)} download><Download size={15} />Run sheets (PDF)</a>
      </div>
      <PlanSettings flagged={flagged} value={settings} onChange={onSettings} />
    </section>
  );
}
