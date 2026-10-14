import { useEffect, useState } from 'react';
import { Download, FileText } from 'lucide-react';
import { api } from '../api';
import { useStore } from '../store';
import type { PlanSummary } from '../types';
import { fmt, fmtDateTime, fmtDuration } from '../lib/format';

export default function ReportsPage() {
  const { plan, openPlan, state, toast } = useStore();
  const [list, setList] = useState<PlanSummary[] | null>(null);
  const latestId = state?.latest_plan?.id;
  useEffect(() => { api.plans().then(setList).catch((e) => { toast(e instanceof Error ? e.message : 'Could not load plans', 'error'); setList([]); }); }, [latestId, toast]);

  return (
    <div className="page page--scroll">
      <div className="reports">
        <section>
          <h2>Dispatch reports</h2>
          <p className="muted" style={{ margin: '4px 0 16px' }}>Each plan you generate is saved here with a printable PDF: which truck goes where, when it arrives, and what it carries.</p>
          {list == null ? <span className="spinner" /> : list.length === 0 ? (
            <div className="empty"><strong>No plans yet</strong>Generate a dispatch plan and its report will appear here.<a className="btn btn--primary" href="#/dispatch">Go to Dispatch</a></div>
          ) : (
            <div className="tablewrap">
              <table className="rtable">
                <thead><tr><th>Conditions</th><th>Created</th><th className="r">Delivered</th><th className="r">Distance</th><th className="r">Last delivery after</th><th /></tr></thead>
                <tbody>
                  {list.map((p) => (
                    <tr key={p.id} className={plan?.plan_id === p.id ? 'is-current' : ''}>
                      <td><b>{p.name}</b>{plan?.plan_id === p.id && <span className="pill pill--plain" style={{ marginLeft: 8 }}>Open in Dispatch</span>}</td>
                      <td>{fmtDateTime(p.created_at)}</td>
                      <td className="r num">{fmt(p.coverage_pct, 0)}%</td>
                      <td className="r num">{fmt(p.total_distance_km, 0)} km</td>
                      <td className="r num">{fmtDuration(p.total_time_hours)}</td>
                      <td className="r actions">
                        <a className="btn btn--sm" href="#/dispatch" onClick={() => openPlan(p.id)}>Open</a>
                        <a className="btn btn--sm" href={api.pdfUrl(p.id)} download><Download size={14} />PDF</a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="about">
          <h2><FileText size={18} style={{ verticalAlign: '-3px', marginRight: 8 }} />How plans are made</h2>
          <div className="about__cols">
            <div>
              <h3>Risk</h3>
              <p>Each zone gets flood, wind and earthquake scores from fixed rules: IMD rainfall and wind thresholds, how low-lying the zone is, how many known flood hotspots it holds, and earthquake shaking by distance. The disaster meter blends the worst zone with the population-weighted average. Nothing is predicted by a learned model, so every score can be explained.</p>
            </div>
            <div>
              <h3>Routes and trucks</h3>
              <p>A* search finds the fastest open road between every depot and area, slowing or avoiding flooded roads. A genetic algorithm then decides which truck serves which areas, in which order, within each truck’s load and fuel limits. Arrival times add 18 minutes of unloading per stop.</p>
            </div>
            <div>
              <h3>Data and limits</h3>
              <p>Zone and ward shapes come from Datameet and Transparent Chennai (CC BY-SA 2.5 IN). Rain, wind and sea readings come from Open-Meteo, and earthquakes from USGS. Depot locations, stock levels, truck counts and flood-hotspot lists are representative placeholders, and populations are modelled estimates. Replace them with your own figures before relying on a plan.</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
