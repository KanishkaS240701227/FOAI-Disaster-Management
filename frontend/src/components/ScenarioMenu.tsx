import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { useStore } from '../store';

const GROUPS: { title: string; test: (k: string) => boolean }[] = [
  { title: 'Right now', test: (k) => k === 'live' },
  { title: 'Replay a past event', test: (k) => k !== 'live' && !k.endsWith('_drill') },
  { title: 'Practice drills', test: (k) => k.endsWith('_drill') },
];

export default function ScenarioMenu() {
  const { state, scenarios, loadScenario, busy } = useStore();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const active = state?.hazard.scenario_key ?? 'live';
  const current = scenarios.find((s) => s.key === active);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open]);

  return (
    <div className="scenario" ref={box}>
      <button className="scenario__btn" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((o) => !o)} disabled={busy === 'scenario'}>
        {busy === 'scenario' ? <span className="spinner" /> : null}
        <span>{current?.short ?? current?.name ?? 'Choose conditions'}</span>
        <ChevronDown size={16} />
      </button>
      {open && (
        <div className="scenario__menu" role="radiogroup" aria-label="Conditions to show">
          {GROUPS.map((g) => {
            const items = scenarios.filter((s) => g.test(s.key));
            if (!items.length) return null;
            return (
              <div key={g.title}>
                <div className="scenario__group">{g.title}</div>
                {items.map((s) => (
                  <button key={s.key} role="radio" aria-checked={s.key === active} className="scenario__item"
                    onClick={() => { setOpen(false); if (s.key !== active) loadScenario(s.key); }}>
                    <span className="scenario__radio" />
                    <span><b>{s.name}</b><small>{s.description}</small></span>
                  </button>
                ))}
              </div>
            );
          })}
          <div className="scenario__group" style={{ textTransform: 'none' }}>
            <Check size={12} style={{ verticalAlign: '-2px' }} /> Replays use recorded rainfall and wind figures, so the whole planner can be tried at any time.
          </div>
        </div>
      )}
    </div>
  );
}
