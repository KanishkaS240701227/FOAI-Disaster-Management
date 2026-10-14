/**
 * Real photos of a place, found live on Wikipedia and Wikimedia Commons.
 *
 * Three sources are combined for every place:
 *   article  the lead picture of the place's Wikipedia article (the photo editors chose to represent it)
 *   named    Commons files whose title or description names the place
 *   nearby   Commons files geotagged within a short walk of the point on the map
 * Each candidate is scored, junk (maps, logos, flags, diagrams) is dropped, and the best few are returned
 * with the author and licence that Commons requires us to show. Results are cached in the browser.
 */
import { haversineKm } from './geo';

export type PlaceKind = 'depot' | 'area' | 'zone';
export interface PlaceQuery { kind: PlaceKind; name: string; lat: number; lng: number }
export interface PlacePhoto {
  id: string;
  src: string;            // ~960 px wide, used in the card
  big: string;            // up to 1280 px wide, used in the enlarged view
  caption: string;
  credit: string;         // author
  license: string;        // e.g. CC BY-SA 4.0
  licenseUrl: string | null;
  page: string;           // the file's page on Wikimedia Commons
  origin: 'article' | 'named' | 'nearby';
  metres: number | null;  // distance from the place when the photo is geotagged
}

const COMMONS = 'https://commons.wikimedia.org/w/api.php';
const WIKI = 'https://en.wikipedia.org/w/api.php';
const MAX_PHOTOS = 6;
const SCORE_FLOOR = 30;

// ------------------------------------------------------------------ text helpers

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const STOP = new Set(['chennai', 'madras', 'the', 'of', 'and', 'in', 'at', 'india', 'tamil', 'nadu']);
const tokens = (s: string) => norm(s).split(' ').filter((t) => t.length > 2 && !STOP.has(t));

/** Common alternative spellings used on Wikipedia for places around Chennai. */
function spellings(term: string): string[] {
  const out = new Set<string>([term]);
  out.add(term.replace(/\bthiru/gi, 'Tiru'));
  out.add(term.replace(/\bchrompet\b/gi, 'Chromepet'));
  out.add(term.replace(/\bkoyambedu\b/gi, 'Koyembedu'));
  out.add(term.replace(/\bthiruvanmiyur\b/gi, 'Tiruvanmiyur'));
  return [...out];
}

/** 0 = unrelated, 0.5 = partly names a term, 1 = every word of a term is present. */
function nameStrength(haystack: string, terms: string[]): number {
  const h = new Set(tokens(haystack));
  let best = 0;
  for (const t of terms) {
    for (const v of spellings(t)) {
      const tk = tokens(v);
      if (!tk.length) continue;
      const hit = tk.filter((x) => h.has(x)).length / tk.length;
      best = Math.max(best, hit >= 1 ? 1 : hit >= 0.5 ? 0.5 : 0);
    }
  }
  return best;
}

// ------------------------------------------------------------------ what to search for

/** The depots that ship with the app are named after real landmarks; search for the landmark. */
const DEPOT_HINTS: Record<string, string[]> = {
  'ripon buildings command depot': ['Ripon Building'],
  'koyambedu market logistics hub': ['Koyambedu Wholesale Market Complex', 'Koyambedu'],
  'royapuram port side warehouses': ['Chennai Port', 'Royapuram'],
  'ambattur industrial estate depot': ['Ambattur Industrial Estate'],
  'guindy industrial estate depot': ['Guindy Industrial Estate'],
  'meenambakkam airport cargo staging': ['Chennai International Airport'],
  'manali industrial relief depot': ['Manali', 'Manali industrial'],
  'madhavaram milk colony depot': ['Madhavaram Milk Colony', 'Madhavaram'],
  'tondiarpet grain godown': ['Tondiarpet'],
  'nehru indoor stadium relief hub': ['Jawaharlal Nehru Indoor Stadium', 'Nehru Indoor Stadium'],
  'anna university campus hub': ['Anna University'],
  'alandur st thomas mount depot': ['St. Thomas Mount', 'Alandur'],
  'perungudi omr relief depot': ['Perungudi', 'Old Mahabalipuram Road'],
  'sholinganallur omr relief depot': ['Sholinganallur', 'Old Mahabalipuram Road'],
  'avadi heavy vehicles staging area': ['Heavy Vehicles Factory', 'Avadi'],
  'pallavaram cantonment depot': ['Pallavaram Cantonment', 'Pallavaram'],
  'tambaram air force station staging': ['Tambaram Air Force Station', 'Tambaram'],
  'anna nagar zonal depot': ['Anna Nagar'],
  't nagar zonal depot': ['T. Nagar', 'Pondy Bazaar'],
  'adyar zonal relief depot': ['Adyar'],
  'taramani campus hub': ['Taramani', 'Tidel Park'],
  'chrompet bus depot relief point': ['Chromepet'],
  'thiruvottiyur zonal depot': ['Thiruvottiyur'],
};
const ZONE_HINTS: Record<string, string[]> = {
  'thiru vi ka nagar': ['Thiru Vi Ka Nagar', 'Perambur'],
  'valasaravakkam': ['Valasaravakkam', 'Porur'],
};

const GENERIC_DEPOT_WORDS = /\b(depot|hub|relief|zonal|staging|area|point|logistics|command|warehouses?|godown|campus|centre|center|camp|cargo)\b/gi;

export function searchTerms(q: PlaceQuery): string[] {
  const key = norm(q.name);
  const hinted = (q.kind === 'depot' ? DEPOT_HINTS[key] : q.kind === 'zone' ? ZONE_HINTS[key] : undefined) ?? [];
  let base = q.name.replace(/\(.*?\)/g, ' ');
  if (q.kind === 'depot') base = base.replace(GENERIC_DEPOT_WORDS, ' ');
  const parts = base.split(/\s*(?:\/|&|,|\band\b|\s[-–]\s)\s*/i).map((p) => p.replace(/\s+/g, ' ').trim()).filter((p) => norm(p).length > 2);
  const joined = parts.length > 1 ? parts.join(' ') : '';
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of [...hinted, joined, ...parts]) {
    const k = norm(t);
    if (k && !seen.has(k)) { seen.add(k); out.push(t); }
  }
  return out.slice(0, 4);
}

// ------------------------------------------------------------------ Wikimedia API

type Meta = Record<string, { value?: unknown } | undefined>;
interface Info { url: string; thumburl?: string; width: number; height: number; mime: string; descriptionurl: string; extmetadata?: Meta }
interface Page {
  pageid: number; title: string; index?: number; imageinfo?: Info[]; coordinates?: { lat: number; lon: number }[];
  pageimage?: string; description?: string;
}
interface Reply { query?: { pages?: Page[] }; error?: { info?: string } }

// Wikimedia asks clients to go easy: at most a few requests at once, and a short pause then one retry when it says "slow down".
let active = 0;
const waiting: (() => void)[] = [];
const slot = async () => { if (active >= 4) await new Promise<void>((r) => waiting.push(r)); active++; };
const release = () => { active--; waiting.shift()?.(); };

async function wm(base: string, params: Record<string, string | number>): Promise<Page[]> {
  const url = new URL(base);
  const all: Record<string, string | number> = { format: 'json', formatversion: 2, origin: '*', ...params };
  for (const [k, v] of Object.entries(all)) url.searchParams.set(k, String(v));
  await slot();
  try {
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(url.toString());
      if ((res.status === 429 || res.status === 503) && attempt < 2) { await new Promise((r) => setTimeout(r, 900 * (attempt + 1))); continue; }
      if (!res.ok) throw new Error(`Wikimedia answered ${res.status}`);
      const j = (await res.json()) as Reply;
      if (j.error) throw new Error(j.error.info ?? 'Wikimedia error');
      return j.query?.pages ?? [];
    }
  } finally { release(); }
}

const IMAGE_PROPS = {
  prop: 'imageinfo|coordinates',
  iiprop: 'url|size|mime|extmetadata',
  iiurlwidth: 800,
  iiextmetadatafilter: 'ObjectName|ImageDescription|Artist|LicenseShortName|LicenseUrl|Categories',
  colimit: 60,
} as const;

const plain = (html: unknown): string => {
  if (typeof html !== 'string' || !html) return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim();
};
const meta = (m: Meta | undefined, k: string) => plain(m?.[k]?.value);

// ------------------------------------------------------------------ scoring

const JUNK_TITLE = /\b(maps?|locator|logo|flag|seal|emblem|coat of arms|symbol|icon|diagram|chart|graph|infographic|route|timeline|stamp|coin|banner|poster|screenshot|signature|portrait|selfie|montage|collage|ticket|certificate|newspaper|advert\w*|brochure|blueprint|satellite|floor plan|site plan|master plan|manuscript|wikimedia|commons|page \d+|life in india)\b/i;
/** Press and event photos: the people in them are the subject, not the place. */
const PEOPLE = /\b(minister|ministers|shri|smt|chief|secretary|inaugurat\w*|felicitat\w*|honou?r\w*|ceremony|launch\w*|unveil\w*|presid\w*|delegat\w*|governor|commissioner|collector|speech|meeting|conference|sapling|mla|dignitar\w*|address\w*|distribut\w*|chairman|campaign\w*|rally)\b/i;
/** Food, plants and animals photographed in the area: pleasant, but not what the place looks like. */
const SUBJECT = /\b(idli|dosa|sambar|vadai?|chapathi|kurma|puttu|vermicelli|milkshake|biscuit|ghee|uthappam|thali|meals|biryani|coffee|refreshment|drink|recipe|dish|snack|cake|juice|noodles|flowers?|cactus|cereus|vine|apis|bee|grasshopper|butterfly|birds?|crow|moth|beetle|spider|lizard|snake|frog|leaf|leaves|fruit|fungus|mushroom|honey|insect|dragonfly|squirrel|keyboard|computer|workforce|programme|egret|heron|kingfisher|stork|eagle|kite|parrot|pigeon|sparrow|owl|peacock|cormorant|ibis|duck|pelicans?|flamingos?|sandpiper|fish|cow|cattle|dog|cat|monkey|elephant|buffalo|goat|lion|tiger|daboia|viper|poekilocerus|burrito|pizza|burger|basket|lamp|case|eclipse|lunar|solar|comet|iss\d+|astronaut|earth)\b/i;
/** Words that mean the picture shows a place rather than an object. */
const PLACEY = /\b(house|mansion|palace|fort|memorial|hall|school|college|hospital|hotel|shop|signal|toll|plaza|circle|colony|apartment|complex|office|tank|pond|garden|museum|library|view|aerial|road|street|junction|bridge|lake|river|estuary|station|temple|church|mosque|market|stadium|campus|building|buildings|tower|park|beach|harbou?r|flyover|skyline|panorama|city|entrance|gate|canal|creek|marsh|airport|port|metro|railway|bus stand|bus terminus|subway|neighbou?rhood|locality|landscape)\b/i;
// anywhere that is clearly not Chennai: other cities and states
const FAR = /\b(madurai|coimbatore|trichy|tiruchirappalli|salem|tirunelveli|erode|vellore|thanjavur|tiruppur|puducherry|pondicherry|bangalore|bengaluru|hyderabad|mumbai|delhi|kolkata|pune|kochi|cochin|thiruvananthapuram|kerala|karnataka|andhra|himachal|kullu|rohtang|uttarakhand|maharashtra|gujarat|rajasthan|punjab|haryana|kashmir|ladakh|goa|odisha|bihar|assam|nepal|bhutan)\b/i;
const HERE = /\b(chennai|madras|tamil ?nadu|tiruvallur|chengalpattu|kanchipuram|kancheepuram|chromepet|tambaram|avadi|pallavaram|ennore)\b/i;
const OK_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

interface From { art?: number; rank?: number | null; near?: boolean }
interface Cand {
  page: Page; info: Info; art: number; rank: number | null; near: boolean; metres: number | null; score: number;
  caption: string; artist: string;
}

const cleanFileTitle = (t: string) => t.replace(/^File:/i, '').replace(/\.[a-z0-9]{3,4}$/i, '').replace(/\s*\(\d{6,}\)\s*$/, '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim();

function distanceScore(m: number | null, scale: number): number {
  if (m == null) return 0;
  if (m <= 150 * scale) return 34;
  if (m <= 350 * scale) return 28;
  if (m <= 700 * scale) return 22;
  if (m <= 1200 * scale) return 14;
  return 6;
}

function evaluate(page: Page, from: From, q: PlaceQuery, terms: string[]): Cand | null {
  const info = page.imageinfo?.[0];
  if (!info || !OK_MIME.has(info.mime) || !info.width || !info.height) return null;
  if (info.width < 400 || info.height < 260) return null;
  const title = cleanFileTitle(page.title);
  const desc = meta(info.extmetadata, 'ImageDescription');
  const objectName = meta(info.extmetadata, 'ObjectName');
  const cats = meta(info.extmetadata, 'Categories').replace(/\|/g, ' ');
  const text = `${title} ${objectName} ${desc} ${cats}`;
  if (JUNK_TITLE.test(title) || JUNK_TITLE.test(objectName)) return null;

  const c = page.coordinates?.[0];
  const metres = c ? Math.round(haversineKm([q.lng, q.lat], [c.lon, c.lat]) * 1000) : null;
  // geotagged somewhere else entirely (another Anna Nagar, say)
  if (metres != null && metres > 40000) return null;
  // not geotagged: it has to say, in its title, categories or description, that it is about this part of the world
  if (metres == null && !from.art) {
    if (FAR.test(text) && !/\b(chennai|madras)\b/i.test(text)) return null;
    if (!HERE.test(`${title} ${objectName} ${cats}`) && !(HERE.test(desc) && !FAR.test(text))) return null;
  }

  const strongName = nameStrength(`${title} ${objectName}`, terms);
  const looseName = Math.max(strongName, nameStrength(desc, terms) * 0.6, nameStrength(cats, terms) * 0.5);

  let score = 0;
  score += from.art ?? 0;
  if (from.rank != null) score += Math.max(0, 16 - from.rank * 1.2);
  score += 30 * looseName;
  if (from.near || metres != null) score += distanceScore(metres, q.kind === 'zone' ? 3 : 1);
  if (info.width >= 1600) score += 6; else if (info.width >= 1000) score += 3; else if (info.width < 700) score -= 14;
  const ratio = info.width / info.height;
  if (ratio >= 1.15 && ratio <= 2.1) score += 5; else if (ratio < 0.85) score -= 10;
  // a named hit that is far from the point and says nothing about the place is probably a different place
  if (!from.art && !from.near && looseName === 0) score -= 30;
  const placey = PLACEY.test(`${title} ${cats}`);
  if (placey) score += 6; else if (!from.art && strongName < 1) score -= 14;
  const headline = `${title} ${objectName}`;
  if (PEOPLE.test(headline)) score -= 45;
  if (SUBJECT.test(headline) && strongName < 1) score -= 30;

  const rawCaption = (objectName && objectName.length > 6 && !/^\d+$/.test(objectName) ? objectName : '') || (desc && desc.length > 6 && desc.length < 140 ? desc : '') || title;
  const caption = /^mapillary\b/i.test(rawCaption) ? 'Street-level photo near this spot' : rawCaption;
  return {
    page, info, art: from.art ?? 0, rank: from.rank ?? null, near: !!from.near, metres, score, caption: caption.slice(0, 120),
    artist: meta(info.extmetadata, 'Artist').slice(0, 60) || 'Wikimedia Commons contributor',
  };
}

function toPhoto(c: Cand): PlacePhoto {
  const m = c.info.extmetadata;
  const file = c.page.title.replace(/^File:/i, '');
  const w = Math.min(1280, c.info.width);
  return {
    id: String(c.page.pageid),
    src: c.info.thumburl || c.info.url,
    big: `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file.replace(/ /g, '_'))}?width=${w}`,
    caption: c.caption,
    credit: c.artist,
    license: meta(m, 'LicenseShortName') || 'See file page',
    licenseUrl: meta(m, 'LicenseUrl') || null,
    page: c.info.descriptionurl,
    origin: c.art > 0 ? 'article' : c.near && c.rank == null ? 'nearby' : 'named',
    metres: c.metres,
  };
}

// ------------------------------------------------------------------ the lookup

async function lookup(q: PlaceQuery): Promise<PlacePhoto[]> {
  const terms = searchTerms(q);
  if (!terms.length) terms.push(q.name);
  const radius = q.kind === 'zone' ? 3500 : 1200;

  const near = wm(COMMONS, { action: 'query', generator: 'geosearch', ggscoord: `${q.lat}|${q.lng}`, ggsradius: radius, ggsnamespace: 6, ggslimit: 40, ...IMAGE_PROPS });
  const named = terms.slice(0, 2).map((t) => wm(COMMONS, { action: 'query', generator: 'search', gsrsearch: `${t} Chennai`, gsrnamespace: 6, gsrlimit: 20, ...IMAGE_PROPS }));
  const articles = terms.slice(0, 2).map((t) => wm(WIKI, {
    action: 'query', generator: 'search', gsrsearch: `${t} Chennai`, gsrnamespace: 0, gsrlimit: 4,
    prop: 'pageimages|coordinates|description', piprop: 'name', colimit: 10,
  }));

  const settled = await Promise.allSettled([near, ...named, ...articles]);
  if (settled.every((s) => s.status === 'rejected')) throw new Error('Could not reach Wikimedia');
  const ok = (i: number): Page[] => { const s = settled[i]; return s.status === 'fulfilled' ? s.value : []; };

  const byId = new Map<number, Cand>();
  const add = (page: Page, from: From) => {
    const c = evaluate(page, from, q, terms);
    if (!c) return;
    const old = byId.get(page.pageid);
    if (!old) { byId.set(page.pageid, c); return; }
    // the same file found twice: score it again with every way it was found
    const merged = evaluate(page, { art: Math.max(old.art, from.art ?? 0), rank: old.rank ?? from.rank ?? null, near: old.near || from.near }, q, terms);
    if (merged) byId.set(page.pageid, merged);
  };

  ok(0).forEach((p) => add(p, { near: true }));
  for (let i = 0; i < named.length; i++) ok(1 + i).forEach((p) => add(p, { rank: p.index ?? 10 }));

  // lead pictures of matching Wikipedia articles, then their licence details from Commons.
  // An article named exactly like the place is the best source there is; one that merely contains the name counts for less.
  const leadFiles = new Map<string, number>();
  const exact = new Set(terms.flatMap((t) => spellings(t)).map(norm));
  for (let i = 0; i < articles.length; i++) {
    for (const p of ok(1 + named.length + i)) {
      if (!p.pageimage || nameStrength(p.title, terms) < 1) continue;
      const at = p.coordinates?.[0];
      const local = at ? haversineKm([q.lng, q.lat], [at.lon, at.lat]) < 40 : HERE.test(p.description ?? '');
      if (!local) continue;
      const f = `File:${p.pageimage.replace(/_/g, ' ')}`;
      const bonus = exact.has(norm(p.title)) ? 62 : 26;
      leadFiles.set(f, Math.max(leadFiles.get(f) ?? 0, bonus));
    }
  }
  if (leadFiles.size) {
    try {
      const wanted = [...leadFiles.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
      const pages = await wm(COMMONS, { action: 'query', titles: wanted.map(([f]) => f).join('|'), ...IMAGE_PROPS });
      const bonusOf = new Map(wanted.map(([f, b]) => [f.replace(/_/g, ' ').toLowerCase(), b]));
      pages.forEach((p) => add(p, { art: bonusOf.get(p.title.replace(/_/g, ' ').toLowerCase()) ?? 26 }));
    } catch { /* the article photos are a bonus */ }
  }

  const ranked = [...byId.values()].sort((a, b) => b.score - a.score);
  const out: Cand[] = [];
  const stems = new Set<string>();
  const perArtist = new Map<string, number>();
  for (const c of ranked) {
    if (c.score < SCORE_FLOOR || out.length >= MAX_PHOTOS) break;
    const stem = norm(cleanFileTitle(c.page.title)).replace(/\d+/g, '').trim();
    if (stems.has(stem)) continue;
    if ((perArtist.get(c.artist) ?? 0) >= 3) continue;
    stems.add(stem);
    perArtist.set(c.artist, (perArtist.get(c.artist) ?? 0) + 1);
    out.push(c);
  }
  return out.map(toPhoto);
}

// ------------------------------------------------------------------ cache

const LS_KEY = 'crc.photos.v1';
const FOUND_TTL = 14 * 86400_000;
const EMPTY_TTL = 86400_000;
type Stored = Record<string, { t: number; photos: PlacePhoto[] }>;
const inflight = new Map<string, Promise<PlacePhoto[]>>();

export const photoKey = (q: PlaceQuery) => `${q.kind}|${norm(q.name)}|${q.lat.toFixed(3)},${q.lng.toFixed(3)}`;

function readStore(): Stored {
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? '{}') as Stored; } catch { return {}; }
}
function writeStore(key: string, photos: PlacePhoto[]) {
  try {
    const all = readStore();
    all[key] = { t: Date.now(), photos };
    const keys = Object.keys(all);
    if (keys.length > 160) keys.sort((a, b) => all[a].t - all[b].t).slice(0, keys.length - 160).forEach((k) => delete all[k]);
    localStorage.setItem(LS_KEY, JSON.stringify(all));
  } catch { /* storage full or blocked: photos still show, they just are not remembered */ }
}

export function cachedPhotos(q: PlaceQuery): PlacePhoto[] | null {
  const e = readStore()[photoKey(q)];
  if (!e) return null;
  return Date.now() - e.t < (e.photos.length ? FOUND_TTL : EMPTY_TTL) ? e.photos : null;
}

/** Photos for a place. Resolves with an empty list when nothing suitable exists; rejects when Wikimedia cannot be reached. */
export function loadPhotos(q: PlaceQuery, fresh = false): Promise<PlacePhoto[]> {
  const key = photoKey(q);
  if (!fresh) {
    const hit = cachedPhotos(q);
    if (hit) return Promise.resolve(hit);
  }
  const running = inflight.get(key);
  if (running) return running;
  const p = lookup(q).then((photos) => { writeStore(key, photos); return photos; }).finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

// ------------------------------------------------------------------ links that need no key

export const mapsUrl = (lat: number, lng: number) => `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
export const streetViewUrl = (lat: number, lng: number) => `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`;
export const commonsSearchUrl = (name: string) => `https://commons.wikimedia.org/w/index.php?search=${encodeURIComponent(`${name} Chennai`)}&ns6=1&fulltext=1`;
