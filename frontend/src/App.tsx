import { Component, type ReactNode } from 'react';
import { FileText, Map as MapIcon, Moon, RefreshCw, Route, Sun, Warehouse as WarehouseIcon, TriangleAlert } from 'lucide-react';
import { useHashRoute, useStore } from './store';
import ScenarioMenu from './components/ScenarioMenu';
import MapPage from './pages/MapPage';
import DispatchPage from './pages/DispatchPage';
import ResourcesPage from './pages/ResourcesPage';
import ReportsPage from './pages/ReportsPage';
import { ago } from './lib/format';

const NAV = [
  { id: 'map', label: 'Map', title: 'Live map', Icon: MapIcon },
  { id: 'dispatch', label: 'Dispatch', title: 'Dispatch plan', Icon: Route },
  { id: 'resources', label: 'Resources', title: 'Depots, fleet and needs', Icon: WarehouseIcon },
  { id: 'reports', label: 'Reports', title: 'Plan reports', Icon: FileText },
] as const;

class Boundary extends Component<{ children: ReactNode }, { err: Error | null }> {
  state = { err: null as Error | null };
  static getDerivedStateFromError(err: Error) { return { err }; }
  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div className="page page--scroll"><div className="center-note">
        <TriangleAlert size={28} />
        <h2>This screen hit a problem</h2>
        <p className="muted">{this.state.err.message}</p>
        <button className="btn" onClick={() => { this.setState({ err: null }); }}>Try again</button>
      </div></div>
    );
  }
}

function Logo() {
  return (
    <svg width="34" height="34" viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="var(--ink)" />
      <rect x="8" y="7" width="4.5" height="12" fill="var(--surface)" />
      <rect x="14" y="11" width="4.5" height="8" fill="var(--surface)" />
      <rect x="20" y="9" width="4" height="10" fill="var(--surface)" />
      <path d="M5 21c3.2-3.2 5.4 2.6 11 0s7.8 2.6 11 0v6H5z" fill="var(--water)" />
    </svg>
  );
}

function Fresh() {
  const { state, now, refreshLive, busy } = useStore();
  if (!state) return null;
  const h = state.hazard.state;
  if (h.mode === 'scenario') {
    return <span className="fresh fresh--replay"><i className="fresh__dot" /><span className="fresh__text">Replaying recorded figures</span></span>;
  }
  const failed = Object.values(h.sources).filter((s) => !s.ok);
  const stale = h.stale || h.mode === 'offline' || failed.length > 0;
  return (
    <span className={`fresh ${stale ? 'fresh--stale' : ''}`}>
      <i className="fresh__dot" />
      <span className="fresh__text">
        {h.mode === 'offline' ? 'Live feeds unreachable, showing typical conditions'
          : stale ? `Some live feeds unreachable · last good reading ${ago(h.fetched_at, now)}`
            : `Live · updated ${ago(h.fetched_at, now)}`}
      </span>
      <button className="btn btn--quiet btn--icon btn--sm" onClick={refreshLive} disabled={busy === 'refresh'} aria-label="Refresh live readings" title="Refresh live readings">
        {busy === 'refresh' ? <span className="spinner" /> : <RefreshCw size={15} />}
      </button>
    </span>
  );
}

export default function App() {
  const [route] = useHashRoute();
  const { state, loadError, loadAttempts, theme, toggleTheme, toasts } = useStore();
  const current = NAV.find((n) => n.id === route) ?? NAV[0];

  let body: ReactNode;
  if (!state && loadError) {
    const slow = loadAttempts >= 8;
    body = (
      <div className="page page--scroll"><div className="center-note">
        {slow ? <TriangleAlert size={28} /> : <span className="spinner" />}
        <h2>{slow ? 'The planner service is not answering' : 'Starting the planner service…'}</h2>
        <p className="muted">{slow ? loadError : 'This takes a few seconds the first time. The page keeps trying by itself.'}</p>
        {slow && <p>Check the window titled <b>Chennai Relief - API</b> for an error. To start it by hand, run <code>python -m uvicorn backend.main:app --port 8765</code> in the project folder.</p>}
        {slow && <button className="btn btn--primary" onClick={() => window.location.reload()}>Reload</button>}
      </div></div>
    );
  } else if (!state) {
    body = <div className="page"><div className="center-note"><span className="spinner" /><p className="muted">Loading Chennai…</p></div></div>;
  } else {
    body = (
      <Boundary key={current.id}>
        {current.id === 'map' && <MapPage />}
        {current.id === 'dispatch' && <DispatchPage />}
        {current.id === 'resources' && <ResourcesPage />}
        {current.id === 'reports' && <ReportsPage />}
      </Boundary>
    );
  }

  return (
    <div className="app">
      <nav className="rail" aria-label="Main">
        <div className="rail__mark"><Logo /></div>
        {NAV.map(({ id, label, title, Icon }) => (
          <a key={id} href={`#/${id}`} className="rail__link" aria-current={id === current.id ? 'page' : undefined} title={title}>
            <Icon size={20} strokeWidth={1.9} />
            <span>{label}</span>
          </a>
        ))}
        <div className="rail__spacer" />
        <button className="btn btn--quiet btn--icon" onClick={toggleTheme} aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'} title={theme === 'dark' ? 'Light theme' : 'Dark theme'}>
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </nav>
      <div className="main">
        <header className="top">
          <h1 className="top__title">
            <span className="top__long">{current.title}</span>
            <span className="top__short">{current.label}</span>
            <small>Chennai and suburbs</small>
          </h1>
          <div className="top__spacer" />
          <Fresh />
          <ScenarioMenu />
        </header>
        {body}
      </div>
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => <div key={t.id} className={`toast ${t.kind === 'error' ? 'toast--error' : ''}`}>{t.text}</div>)}
      </div>
    </div>
  );
}
