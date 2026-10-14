import { Download, Info } from 'lucide-react';
import { api } from '../api';
import { useStore } from '../store';
import { fmt } from '../lib/format';

export default function RoadDataNotice({ compact = false, slim = false }: { compact?: boolean; slim?: boolean }) {
  const { state, refresh, toast } = useStore();
  if (!state) return null;
  const net = state.network;
  const imp = net.import;

  if (imp.state === 'running') {
    return (
      <div className="notice notice--info">
        <Info size={16} />
        <div>
          <b>Downloading the real road map…</b>
          <span>{imp.message || 'Fetching roads from OpenStreetMap.'}</span>
          <div className="bar"><i style={{ width: `${Math.max(6, Math.round((imp.progress || 0) * 100))}%` }} /></div>
        </div>
      </div>
    );
  }
  if (net.source === 'osm') {
    if (compact) return null;
    return <p className="muted" style={{ fontSize: 'var(--fs-sm)' }}>Using the real road map: {fmt(net.nodes)} junctions, {fmt(net.edges)} road segments.</p>;
  }
  const start = async () => {
    try { await api.downloadRoads(); toast('Road download started. It takes a minute or two.'); await refresh(); }
    catch (e) { toast(e instanceof Error ? e.message : 'Could not start the download', 'error'); }
  };
  if (slim && imp.state !== 'error') {
    return (
      <div className="notice notice--slim">
        <Info size={16} />
        <span>Roads are approximate, so times are estimates.</span>
        <button className="btn btn--sm" onClick={start}><Download size={14} />Get real roads</button>
      </div>
    );
  }
  return (
    <div className={`notice ${imp.state === 'error' ? 'notice--error' : ''}`}>
      <Info size={16} />
      <div>
        <b>{imp.state === 'error' ? 'Road download failed' : 'Routes use an approximate road network'}</b>
        <span>{imp.state === 'error' ? imp.error : 'Distances and times are estimates until the real road map is downloaded (about 1–2 minutes, needs internet).'}</span>
        <div><button className="btn btn--sm" onClick={start}><Download size={14} />Download real roads</button></div>
      </div>
    </div>
  );
}
