import { useId } from 'react';
import type { Level } from '../types';
import { scoreLevel } from '../lib/format';

const LEVELS: { at: number; name: Level; color: string }[] = [
  { at: 75, name: 'Severe', color: 'var(--lvl-severe)' },
  { at: 50, name: 'High', color: 'var(--lvl-high)' },
  { at: 25, name: 'Elevated', color: 'var(--lvl-elevated)' },
  { at: 0, name: 'Low', color: 'var(--lvl-low)' },
];

/**
 * Flood-staff style gauge: the same graduated board river authorities fix to a bridge pier.
 * Water rises with the 0-100 disaster meter; the left strip carries the four risk bands.
 */
export default function Gauge({ value, height = 232 }: { value: number; height?: number }) {
  const id = useId();
  const w = 74;
  const top = 8;
  const bottom = height - 8;
  const span = bottom - top;
  const y = (v: number) => bottom - (Math.max(0, Math.min(100, v)) / 100) * span;
  const lvl = scoreLevel(value);
  const wy = y(value);
  const wave = `M0 ${wy} q 6 -4 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 L ${w} ${bottom} L 0 ${bottom} Z`;
  return (
    <svg className="gauge" width={w} height={height} viewBox={`0 0 ${w} ${height}`} role="img" aria-label={`Disaster meter ${Math.round(value)} out of 100, ${lvl}`}>
      <defs>
        <clipPath id={id}><rect x="14" y={top} width="30" height={span} rx="3" /></clipPath>
      </defs>
      {/* risk bands */}
      {LEVELS.map((l, i) => {
        const hi = i === 0 ? 100 : LEVELS[i - 1].at;
        return <rect key={l.name} x="6" y={y(hi)} width="5" height={y(l.at) - y(hi) - 1} rx="1" fill={l.color} />;
      })}
      {/* staff board */}
      <rect x="14" y={top} width="30" height={span} rx="3" fill="var(--surface-3)" stroke="var(--line-strong)" />
      <g clipPath={`url(#${id})`}>
        <g className="gauge__water" style={{ transition: 'transform 900ms cubic-bezier(.2,.7,.2,1)' }}>
          <path d={wave} fill="var(--water-deep)" opacity="0.85" />
          <path d={`M0 ${wy + 5} q 6 -4 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 t 12 0 L ${w} ${bottom} L 0 ${bottom} Z`} fill="var(--water-deep)" opacity="0.55" />
        </g>
      </g>
      {/* graduations */}
      {Array.from({ length: 21 }, (_, i) => i * 5).map((v) => {
        const major = v % 25 === 0;
        return (
          <g key={v}>
            <line x1="44" x2={major ? 36 : 40} y1={y(v)} y2={y(v)} stroke="var(--ink-2)" strokeWidth={major ? 1.4 : 1} opacity={major ? 0.9 : 0.5} />
            {major && <text x="50" y={y(v) + 3.5} fontSize="10" fill="var(--ink-3)" fontFamily="var(--font-ui)" className="num">{v}</text>}
          </g>
        );
      })}
      {/* water line marker */}
      <path d={`M12 ${wy} l -7 -5 v 10 z`} fill="var(--ink)" />
      <line x1="12" x2="44" y1={wy} y2={wy} stroke="var(--ink)" strokeWidth="1.6" />
    </svg>
  );
}
