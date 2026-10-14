import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { fmt } from '../lib/format';

const W = 348;
const H = 84;

/** Next-48-hour outlook: rain as bars, wind gusts as a line. Only exists for live conditions, so replays and drills render nothing. */
export default function Forecast() {
  const { state } = useStore();
  const tl = state?.hazard.state.timeline ?? [];
  const [hover, setHover] = useState<number | null>(null);

  const d = useMemo(() => {
    if (!tl.length) return null;
    const maxRain = Math.max(8, ...tl.map((p) => p.rain));
    const maxGust = Math.max(60, ...tl.map((p) => p.gust));
    const bw = W / tl.length;
    const nowIdx = tl.findIndex((p) => new Date(p.t).getTime() > Date.now()) - 1;
    const peakRain = tl.reduce((a, p) => (p.rain > a.rain ? p : a), tl[0]);
    const peakGust = tl.reduce((a, p) => (p.gust > a.gust ? p : a), tl[0]);
    return { maxRain, maxGust, bw, nowIdx, peakRain, peakGust };
  }, [tl]);

  if (!d) return null;

  const when = (iso: string) => new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', hour: 'numeric', hour12: true });
  const hp = hover != null ? tl[hover] : null;
  const gustPath = tl.map((p, i) => `${i === 0 ? 'M' : 'L'}${(i + 0.5) * d.bw},${H - 16 - (p.gust / d.maxGust) * (H - 28)}`).join(' ');
  const dayMarks = tl.map((p, i) => ({ i, hour: Number(new Date(p.t).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', hour12: false })), t: p.t }))
    .filter((m) => m.hour === 0 || m.hour === 12);

  return (
    <div className="fc">
      <p className="fc__sum">
        {hp ? `${when(hp.t)}: ${fmt(hp.rain, 1)} mm/h rain, gusts ${fmt(hp.gust)} km/h`
          : `Heaviest rain ${fmt(d.peakRain.rain, 1)} mm/h around ${when(d.peakRain.t)}. Strongest gusts ${fmt(d.peakGust.gust)} km/h.`}
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="Rain and wind forecast for the next 48 hours"
        onMouseLeave={() => setHover(null)} onMouseMove={(e) => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          setHover(Math.max(0, Math.min(tl.length - 1, Math.floor(((e.clientX - r.left) / r.width) * tl.length))));
        }}>
        {tl.map((p, i) => {
          const bh = (p.rain / d.maxRain) * (H - 28);
          return <rect key={p.t} x={i * d.bw + 0.5} y={H - 16 - bh} width={Math.max(d.bw - 1, 1)} height={Math.max(bh, p.rain > 0 ? 1 : 0)}
            fill="var(--water-deep)" opacity={i <= d.nowIdx ? 0.45 : 0.9} />;
        })}
        <path d={gustPath} fill="none" stroke="var(--ink)" strokeWidth="1.4" opacity="0.8" />
        {d.nowIdx >= 0 && <line x1={(d.nowIdx + 1) * d.bw} x2={(d.nowIdx + 1) * d.bw} y1="0" y2={H - 14} stroke="var(--accent)" strokeWidth="1.5" strokeDasharray="3 2" />}
        {hover != null && <line x1={(hover + 0.5) * d.bw} x2={(hover + 0.5) * d.bw} y1="0" y2={H - 14} stroke="var(--ink-2)" strokeWidth="1" />}
        {dayMarks.map((m) => {
          const x = (m.i + 0.5) * d.bw;
          return (
            <text key={m.t} x={x} y={H - 3} fontSize="10" fill="var(--ink-3)" textAnchor={x < 18 ? 'start' : x > W - 18 ? 'end' : 'middle'} fontFamily="var(--font-ui)">
              {m.hour === 0 ? new Date(m.t).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short' }) : 'noon'}
            </text>
          );
        })}
      </svg>
      <div className="fc__legend"><i style={{ background: 'var(--water-deep)' }} />Rain per hour<i className="fc__line" />Wind gusts<i className="fc__now" />Now</div>
    </div>
  );
}
