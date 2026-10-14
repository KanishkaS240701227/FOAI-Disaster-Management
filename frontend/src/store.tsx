import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api } from './api';
import type { AppState, FC, Plan, ScenarioItem } from './types';

type Theme = 'light' | 'dark';
export interface Toast { id: number; text: string; kind: 'info' | 'error' }
export interface PlanOptions { generations: number; population_size: number; max_areas: number }

interface Store {
  state: AppState | null;
  zones: FC | null;
  outline: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon> | null;
  bounds: [[number, number], [number, number]] | null;
  scenarios: ScenarioItem[];
  loadError: string | null;
  loadAttempts: number;
  busy: 'scenario' | 'refresh' | 'plan' | null;
  theme: Theme;
  toggleTheme: () => void;
  refresh: () => Promise<void>;
  loadScenario: (key: string) => Promise<void>;
  refreshLive: () => Promise<void>;
  plan: Plan | null;
  /** The saved plan (if any) has been fetched, so the page knows whether it must make one. */
  planChecked: boolean;
  /** A plan the person opened on purpose from Reports; it is never replaced automatically. */
  planPinned: boolean;
  generatePlan: (o: PlanOptions) => Promise<void>;
  openPlan: (id: string) => Promise<void>;
  selectedTruck: string | null;
  selectTruck: (id: string | null) => void;
  toasts: Toast[];
  toast: (text: string, kind?: 'info' | 'error') => void;
  zoneName: (id: string | null | undefined) => string;
  now: number;
}

const Ctx = createContext<Store | null>(null);
export const useStore = (): Store => {
  const v = useContext(Ctx);
  if (!v) throw new Error('useStore outside provider');
  return v;
};

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState | null>(null);
  const [zones, setZones] = useState<FC | null>(null);
  const [outline, setOutline] = useState<Store['outline']>(null);
  const [bounds, setBounds] = useState<Store['bounds']>(null);
  const [scenarios, setScenarios] = useState<ScenarioItem[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempts, setLoadAttempts] = useState(0);
  const [busy, setBusy] = useState<Store['busy']>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [planChecked, setPlanChecked] = useState(false);
  const [planPinned, setPlanPinned] = useState(false);
  const [selectedTruck, selectTruck] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [now, setNow] = useState(Date.now());
  const [theme, setTheme] = useState<Theme>(() => (document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'));
  const scenarioKey = useRef<string | null>(null);

  const toast = useCallback((text: string, kind: 'info' | 'error' = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, kind }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 7000 : 3800);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((t) => {
      const next = t === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem('crc-theme', next); } catch { /* storage unavailable */ }
      return next;
    });
  }, []);

  const refresh = useCallback(async () => {
    try {
      const s = await api.state();
      setState(s);
      setLoadError(null);
      if (scenarioKey.current !== s.hazard.scenario_key) {
        scenarioKey.current = s.hazard.scenario_key;
      }
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Cannot reach the server');
    }
  }, []);

  // first load: geography is static, state is polled. The API may still be starting, so keep trying.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (let attempt = 0; !cancelled; attempt++) {
        try {
          const [z, o, m, sc] = await Promise.all([api.zones(), api.outline(), api.meta(), api.scenarios()]);
          if (cancelled) return;
          setZones(z); setOutline(o); setBounds(m.bounds); setScenarios(sc.items);
          break;
        } catch (e) {
          if (cancelled) return;
          setLoadError(e instanceof Error ? e.message : 'Cannot reach the server');
          setLoadAttempts(attempt + 1);
          await new Promise((r) => window.setTimeout(r, Math.min(1500 + attempt * 500, 4000)));
        }
      }
      if (cancelled) return;
      await refresh();
      try {
        const lp = await api.latestPlan();
        if (!cancelled) setPlan(lp);
      } catch { /* no plan yet */ }
      if (!cancelled) setPlanChecked(true);
    })();
    return () => { cancelled = true; };
  }, [refresh]);

  // keep fresh: every minute, and every 3 s while roads are downloading
  const importing = state?.network.import.state === 'running';
  useEffect(() => {
    const ms = importing ? 3000 : 60000;
    const id = window.setInterval(() => { if (!document.hidden) { refresh(); } }, ms);
    return () => window.clearInterval(id);
  }, [refresh, importing]);
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(id);
  }, []);

  const loadScenario = useCallback(async (key: string) => {
    setBusy('scenario');
    try {
      await api.loadScenario(key);
      setPlan(null);
      setPlanPinned(false);
      selectTruck(null);
      await refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not switch scenario', 'error');
    } finally { setBusy(null); }
  }, [refresh, toast]);

  const refreshLive = useCallback(async () => {
    setBusy('refresh');
    try {
      await api.refreshHazards();
      await refresh();
      toast('Live readings updated');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not refresh live readings', 'error');
    } finally { setBusy(null); }
  }, [refresh, toast]);

  const generatePlan = useCallback(async (o: PlanOptions) => {
    setBusy('plan');
    try {
      const p = await api.generatePlan(o);
      setPlan(p);
      setPlanPinned(false);
      selectTruck(null);
      await refresh();
      toast(p.message || 'Dispatch plan ready');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Planning failed', 'error');
    } finally { setBusy(null); }
  }, [refresh, toast]);

  const openPlan = useCallback(async (id: string) => {
    try {
      const p = await api.plan(id);
      setPlan(p);
      setPlanPinned(true);
      selectTruck(null);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not open that plan', 'error');
    }
  }, [toast]);

  const zoneNames = useMemo(() => {
    const m = new Map<string, string>();
    zones?.features.forEach((f) => m.set(String(f.properties.id), String(f.properties.name)));
    return m;
  }, [zones]);
  const zoneName = useCallback((id: string | null | undefined) => (id ? zoneNames.get(id) ?? id : '–'), [zoneNames]);

  const value: Store = {
    state, zones, outline, bounds, scenarios, loadError, loadAttempts, busy, theme, toggleTheme, refresh, loadScenario, refreshLive,
    plan, planChecked, planPinned, generatePlan, openPlan, selectedTruck, selectTruck, toasts, toast, zoneName, now,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useHashRoute(): [string, (r: string) => void] {
  const read = () => (window.location.hash.replace(/^#\/?/, '') || 'map').split('/')[0];
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const on = () => setRoute(read());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return [route, (r) => { window.location.hash = `/${r}`; }];
}
