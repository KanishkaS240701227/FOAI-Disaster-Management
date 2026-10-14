import type { Plan, TruckPlan } from '../types';
import { addHours } from '../lib/plan';
import { fmt, fmtClock, fmtDuration, sumBundle } from '../lib/format';

export default function TruckTimeline({ plan, truck }: { plan: Plan; truck: TruckPlan }) {
  const stops = new Map(truck.stops_detail.map((s) => [s.location_id, s]));
  let n = 0;
  return (
    <ol className="tl">
      <li className="tl__node tl__node--depot">
        <time>{fmtClock(addHours(plan.plan_start, 0))}</time>
        <div><b>Leave {truck.warehouse_name}</b></div>
      </li>
      {truck.legs.map((leg, i) => {
        const stop = stops.get(leg.to);
        const isReturn = !stop;
        if (stop) n += 1;
        return (
          <li key={i} className="tl__leg-wrap">
            <div className="tl__leg">
              {leg.found ? <>{fmt(leg.km, 1)} km · {fmtDuration(leg.hours)}{leg.slow_segments > 0 ? <span className="tl__slow"> · {leg.slow_segments} slow stretch{leg.slow_segments > 1 ? 'es' : ''}</span> : null}</>
                : <span className="tl__slow">No open road found, straight-line estimate</span>}
            </div>
            <div className={`tl__node ${isReturn ? 'tl__node--depot' : ''}`}>
              <time>{fmtClock(addHours(plan.plan_start, leg.arrive_h))}</time>
              {stop ? (
                <div>
                  <b><span className={`dot sev-${stop.severity}`} style={{ display: 'inline-block', marginRight: 6 }} />{n}. {stop.location_name}</b>
                  <span className="muted tl__sub">Delivers {fmt(sumBundle(stop.delivered))} items · {fmt(stop.people_affected)} people</span>
                </div>
              ) : <div><b>Back at {truck.warehouse_name}</b></div>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
