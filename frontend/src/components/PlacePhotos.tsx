import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera, ChevronLeft, ChevronRight, ExternalLink, ImageOff, Maximize2, RotateCw, X } from 'lucide-react';
import { cachedPhotos, commonsSearchUrl, loadPhotos, photoKey, type PlacePhoto, type PlaceQuery } from '../lib/photos';

type Status = 'loading' | 'ready' | 'empty' | 'offline';

function Lightbox({ photos, start, onClose }: { photos: PlacePhoto[]; start: number; onClose: () => void }) {
  const [i, setI] = useState(start);
  const [sharp, setSharp] = useState(false);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const n = photos.length;
  const step = useCallback((d: number) => { setSharp(false); setI((x) => (x + d + n) % n); }, [n]);

  useEffect(() => {
    const back = document.activeElement as HTMLElement | null;
    closeBtn.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
      else if (e.key === 'ArrowLeft') step(-1);
      else if (e.key === 'ArrowRight') step(1);
    };
    window.addEventListener('keydown', key, true);
    return () => { window.removeEventListener('keydown', key, true); back?.focus?.(); };
  }, [onClose, step]);

  const p = photos[i];
  return createPortal(
    <div className="lightbox" role="dialog" aria-modal="true" aria-label="Photo" onClick={onClose}>
      <figure onClick={(e) => e.stopPropagation()}>
        <div className="lightbox__img">
          <img src={p.src} alt="" aria-hidden="true" className="lightbox__soft" />
          <img src={p.big} alt={p.caption} className={sharp ? 'is-in' : ''} onLoad={() => setSharp(true)} />
        </div>
        <figcaption>
          <b>{p.caption}</b>
          <span>Photo: {p.credit} · <a href={p.licenseUrl ?? p.page} target="_blank" rel="noreferrer">{p.license}</a> · <a href={p.page} target="_blank" rel="noreferrer">Wikimedia Commons</a></span>
        </figcaption>
      </figure>
      <button ref={closeBtn} className="lightbox__close btn btn--icon" onClick={onClose} aria-label="Close photo"><X size={18} /></button>
      {n > 1 && (
        <>
          <button className="lightbox__nav lightbox__nav--prev btn btn--icon" onClick={(e) => { e.stopPropagation(); step(-1); }} aria-label="Previous photo"><ChevronLeft size={20} /></button>
          <button className="lightbox__nav lightbox__nav--next btn btn--icon" onClick={(e) => { e.stopPropagation(); step(1); }} aria-label="Next photo"><ChevronRight size={20} /></button>
        </>
      )}
    </div>,
    document.body,
  );
}

/** A swipeable set of real photographs of a place, with the credit Wikimedia Commons asks for. */
export default function PlacePhotos({ place }: { place: PlaceQuery }) {
  const key = photoKey(place);
  const [state, setState] = useState<{ key: string; status: Status; photos: PlacePhoto[] }>(() => {
    const hit = cachedPhotos(place);
    return { key, status: hit ? (hit.length ? 'ready' : 'empty') : 'loading', photos: hit ?? [] };
  });
  const [idx, setIdx] = useState(0);
  const [big, setBig] = useState(false);
  const [broken, setBroken] = useState<Set<string>>(() => new Set());
  const placeRef = useRef(place);
  placeRef.current = place;

  const fetchNow = useCallback((fresh: boolean) => {
    const k = photoKey(placeRef.current);
    setState((s) => ({ key: k, status: 'loading', photos: s.key === k ? s.photos : [] }));
    loadPhotos(placeRef.current, fresh)
      .then((photos) => setState((s) => (s.key === k ? { key: k, status: photos.length ? 'ready' : 'empty', photos } : s)))
      .catch(() => setState((s) => (s.key === k ? { key: k, status: 'offline', photos: [] } : s)));
  }, []);

  useEffect(() => {
    setIdx(0); setBroken(new Set()); setBig(false);
    const hit = cachedPhotos(placeRef.current);
    if (hit) { setState({ key, status: hit.length ? 'ready' : 'empty', photos: hit }); return; }
    fetchNow(false);
  }, [key, fetchNow]);

  const photos = state.key === key ? state.photos.filter((p) => !broken.has(p.id)) : [];
  const status: Status = state.key !== key ? 'loading' : state.status === 'ready' && photos.length === 0 ? 'empty' : state.status;
  const i = Math.min(idx, Math.max(photos.length - 1, 0));
  const cur = photos[i];
  const go = (d: number) => setIdx((x) => (Math.min(x, photos.length - 1) + d + photos.length) % photos.length);

  // warm the next picture so flipping feels instant
  useEffect(() => {
    if (photos.length < 2) return;
    const nxt = new Image();
    nxt.src = photos[(i + 1) % photos.length].src;
  }, [photos, i]);

  if (status === 'loading') {
    return (
      <div className="pics pics--wait" role="status" aria-live="polite">
        <div className="pics__stage"><span className="pics__shimmer" /><span className="pics__hint"><Camera size={16} />Finding photos of {place.name}…</span></div>
      </div>
    );
  }
  if (status === 'empty' || status === 'offline' || !cur) {
    return (
      <div className="pics pics--none">
        <ImageOff size={18} />
        <div>
          <b>{status === 'offline' ? 'Photos need an internet connection' : 'No photo of this place yet'}</b>
          <p className="muted">{status === 'offline' ? 'They come from Wikipedia and Wikimedia Commons.' : 'Wikimedia Commons has nothing tagged here. Use the links below to look around.'}</p>
          <div className="pics__links">
            {status === 'offline' && <button className="linkish" onClick={() => fetchNow(true)}><RotateCw size={12} /> Try again</button>}
            <a href={commonsSearchUrl(place.name)} target="_blank" rel="noreferrer">Search Wikimedia Commons <ExternalLink size={11} /></a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <figure className="pics">
      <div className="pics__stage">
        <button className="pics__open" onClick={() => setBig(true)} aria-label={`Enlarge photo: ${cur.caption}`}>
          <img key={cur.id} src={cur.src} alt={cur.caption} decoding="async" onError={() => setBroken((b) => new Set(b).add(cur.id))} />
          <span className="pics__zoom" aria-hidden="true"><Maximize2 size={14} /></span>
        </button>
        {photos.length > 1 && (
          <>
            <button className="pics__nav pics__nav--prev" onClick={() => go(-1)} aria-label="Previous photo"><ChevronLeft size={18} /></button>
            <button className="pics__nav pics__nav--next" onClick={() => go(1)} aria-label="Next photo"><ChevronRight size={18} /></button>
            <span className="pics__dots" aria-hidden="true">{photos.map((p, k) => <i key={p.id} className={k === i ? 'is-on' : ''} />)}</span>
          </>
        )}
      </div>
      <figcaption>
        <span className="pics__cap">{cur.caption}{cur.metres != null && cur.origin === 'nearby' ? <em> · taken {cur.metres < 60 ? 'here' : `${cur.metres} m away`}</em> : null}</span>
        <span className="pics__credit">
          Photo: {cur.credit} · <a href={cur.licenseUrl ?? cur.page} target="_blank" rel="noreferrer">{cur.license}</a> · <a href={cur.page} target="_blank" rel="noreferrer">Source</a>
        </span>
      </figcaption>
      {big && <Lightbox photos={photos} start={i} onClose={() => setBig(false)} />}
    </figure>
  );
}
