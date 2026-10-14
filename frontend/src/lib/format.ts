const IST = 'Asia/Kolkata';

export const nf = new Intl.NumberFormat('en-IN');
export const fmt = (n: number | null | undefined, digits = 0) =>
  n == null || Number.isNaN(n) ? '–' : n.toLocaleString('en-IN', { maximumFractionDigits: digits, minimumFractionDigits: digits });

/** 5,30,000 -> "5.3 lakh"; 6,480,000 -> "64.8 lakh"; 1.2 crore stays readable for Indian users */
export function fmtPeople(n: number): string {
  if (n >= 1e7) return `${(n / 1e7).toFixed(2)} crore`;
  if (n >= 1e5) return `${(n / 1e5).toFixed(n >= 1e6 ? 1 : 2)} lakh`;
  return nf.format(Math.round(n));
}

export function fmtClock(iso: string | null | undefined, withDay = false): string {
  if (!iso) return '–';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '–';
  const t = d.toLocaleTimeString('en-IN', { timeZone: IST, hour: 'numeric', minute: '2-digit', hour12: true }).replace(' ', ' ');
  if (!withDay) return t;
  const day = d.toLocaleDateString('en-IN', { timeZone: IST, day: 'numeric', month: 'short' });
  return `${day}, ${t}`;
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '–';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '–';
  return d.toLocaleString('en-IN', { timeZone: IST, day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true });
}

/** 2.62 -> "2 h 37 min", 0.15 -> "9 min" */
export function fmtDuration(hours: number | null | undefined): string {
  if (hours == null || Number.isNaN(hours)) return '–';
  const mins = Math.round(hours * 60);
  if (mins < 1) return '< 1 min';
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')} min`;
}

export function ago(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return 'never';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 'never';
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}

export const RES_LABEL: Record<string, string> = {
  food: 'Food packets', water: 'Drinking water (cans)', medicine: 'Medical kits', blankets: 'Blankets', emergency_kits: 'Emergency kits',
};
export const RES_SHORT: Record<string, string> = {
  food: 'Food', water: 'Water', medicine: 'Medical', blankets: 'Blankets', emergency_kits: 'Kits',
};
export const RES_KEYS = ['food', 'water', 'medicine', 'blankets', 'emergency_kits'] as const;

export const sumBundle = (b: Partial<Record<(typeof RES_KEYS)[number], number>> | undefined) =>
  b ? RES_KEYS.reduce((s, k) => s + (b[k] ?? 0), 0) : 0;

export function levelColor(level: string): string {
  switch (level) {
    case 'Severe': case 'Critical': return 'var(--lvl-severe)';
    case 'High': return 'var(--lvl-high)';
    case 'Elevated': case 'Medium': return 'var(--lvl-elevated)';
    default: return 'var(--lvl-low)';
  }
}
export function scoreLevel(s: number): 'Low' | 'Elevated' | 'High' | 'Severe' {
  return s >= 75 ? 'Severe' : s >= 50 ? 'High' : s >= 25 ? 'Elevated' : 'Low';
}

/** Units of each item one person needs per day (same constants the planner uses). */
export const PER_PERSON: Record<(typeof RES_KEYS)[number], number> = { food: 1.0, water: 0.25, medicine: 0.07, blankets: 0.5, emergency_kits: 0.2 };

/** How many people a stock can support for a day, limited by the scarcest item. */
export function peopleSupported(b: Partial<Record<(typeof RES_KEYS)[number], number>>): number {
  return Math.floor(Math.min(...RES_KEYS.map((k) => (b[k] ?? 0) / PER_PERSON[k])) + 1e-6);
}
