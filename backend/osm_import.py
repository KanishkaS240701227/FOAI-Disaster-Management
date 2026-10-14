"""
Download real Chennai roads from OpenStreetMap (Overpass API) and convert them into the compact
junction graph used by ``roadnet.RoadNetwork``.

Run automatically in the background on first start (if ``roads_osm.json`` is missing), from the
"Download real roads" button, or manually:

    python -m backend.osm_import

Only the standard library is used.  Data (c) OpenStreetMap contributors, ODbL.
"""
from __future__ import annotations

import json
import math
import os
import threading
import time
import urllib.parse
import urllib.request
from collections import defaultdict
from typing import Any, Dict, List, Optional, Tuple

from .roadnet import DATA_DIR, MAJOR

MIRRORS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
]
HIGHWAYS = ("motorway|trunk|primary|secondary|tertiary|motorway_link|trunk_link|primary_link|"
            "secondary_link|tertiary_link")
USER_AGENT = "ChennaiReliefPlanner/2.0 (academic disaster-logistics project)"

STATE: Dict[str, Any] = {"state": "idle", "message": "", "progress": 0.0, "error": None,
                         "started": None, "finished": None, "nodes": 0, "edges": 0}
_thread: Optional[threading.Thread] = None


# ------------------------------------------------------------------ geometry helpers
def _load_outline() -> List[List[List[Tuple[float, float]]]]:
    """Return list of polygons; polygon = [exterior, hole1, ...]; ring = [(lng,lat),...]."""
    with open(os.path.join(DATA_DIR, "outline.geojson"), "r", encoding="utf-8") as fh:
        g = json.load(fh)["geometry"]
    polys = [g["coordinates"]] if g["type"] == "Polygon" else g["coordinates"]
    return [[[(x, y) for x, y in ring] for ring in poly] for poly in polys]


def _in_ring(x: float, y: float, ring: List[Tuple[float, float]]) -> bool:
    inside = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i]
        xj, yj = ring[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi + 1e-18) + xi:
            inside = not inside
        j = i
    return inside


def inside_outline(polys, lat: float, lng: float) -> bool:
    for poly in polys:
        if _in_ring(lng, lat, poly[0]) and not any(_in_ring(lng, lat, h) for h in poly[1:]):
            return True
    return False


def _haversine_km(a: Tuple[float, float], b: Tuple[float, float]) -> float:
    R = 6371.0088
    p1, p2 = math.radians(a[0]), math.radians(b[0])
    dl = math.radians(b[1] - a[1])
    h = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))


# ------------------------------------------------------------------ conversion
def build_network(elements: List[Dict[str, Any]], polys=None) -> Dict[str, Any]:
    """Convert Overpass ``out geom`` way elements into the compact network JSON structure."""
    ways = []
    use = defaultdict(int)
    coord: Dict[int, Tuple[float, float]] = {}
    for el in elements:
        if el.get("type") != "way" or "geometry" not in el or "nodes" not in el:
            continue
        tags = el.get("tags", {})
        hw = tags.get("highway", "")
        base = hw.replace("_link", "")
        if base not in ("motorway", "trunk", "primary", "secondary", "tertiary"):
            continue
        if tags.get("area") == "yes" or tags.get("access") in ("no", "private") and tags.get("motor_vehicle") != "yes":
            continue
        nds = el["nodes"]
        geom = el["geometry"]
        if len(nds) < 2 or len(nds) != len(geom):
            continue
        ow = tags.get("oneway", "")
        if tags.get("junction") == "roundabout" or hw == "motorway":
            ow = ow or "yes"
        direction = 1 if ow in ("yes", "true", "1") else (-1 if ow == "-1" else 0)
        ways.append((nds, geom, base, tags.get("name") or tags.get("ref") or "", direction))
        for n, g in zip(nds, geom):
            coord[n] = (g["lat"], g["lon"])
        for n in nds:
            use[n] += 1
        use[nds[0]] += 1          # endpoints are always junctions
        use[nds[-1]] += 1

    node_index: Dict[int, int] = {}
    nodes: List[List[Any]] = []
    edges: List[List[Any]] = []

    def nid(osm_id: int) -> int:
        if osm_id not in node_index:
            node_index[osm_id] = len(nodes)
            la, lo = coord[osm_id]
            nodes.append([node_index[osm_id], round(la, 6), round(lo, 6)])
        return node_index[osm_id]

    for nds, geom, cls, name, direction in ways:
        seg_start = 0
        for i in range(1, len(nds)):
            if use[nds[i]] >= 2 or i == len(nds) - 1:
                pts = [[g["lat"], g["lon"]] for g in geom[seg_start:i + 1]]
                km = sum(_haversine_km(tuple(pts[k]), tuple(pts[k + 1])) for k in range(len(pts) - 1))
                a_id, b_id = nds[seg_start], nds[i]
                if a_id != b_id and km > 0.004:
                    mid = pts[len(pts) // 2]
                    if polys is None or inside_outline(polys, mid[0], mid[1]):
                        a, b = nid(a_id), nid(b_id)
                        gpts = [[round(p[0], 6), round(p[1], 6)] for p in pts]
                        if direction == -1:
                            a, b = b, a
                            gpts.reverse()
                        edges.append([a, b, round(km, 3), cls, name, 1 if direction else 0, gpts])
                seg_start = i

    # keep only the largest (weakly) connected component
    parent = list(range(len(nodes)))

    def find(x: int) -> int:
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x
    for e in edges:
        ra, rb = find(e[0]), find(e[1])
        if ra != rb:
            parent[ra] = rb
    sizes = defaultdict(int)
    for e in edges:
        sizes[find(e[0])] += 1
    if not sizes:
        raise ValueError("No roads found in the downloaded data")
    main = max(sizes, key=sizes.get)
    keep_nodes = sorted({n for e in edges if find(e[0]) == main for n in (e[0], e[1])})
    remap = {old: new for new, old in enumerate(keep_nodes)}
    out_nodes = [[remap[o], nodes[o][1], nodes[o][2]] for o in keep_nodes]
    out_edges = []
    for e in edges:
        if find(e[0]) == main:
            out_edges.append([remap[e[0]], remap[e[1]], e[2], e[3], e[4], e[5], e[6]])
    return {"source": "osm", "nodes": out_nodes, "edges": out_edges}


# ------------------------------------------------------------------ download
def _post_overpass(query: str, tries_per_mirror: int = 2) -> Dict[str, Any]:
    last: Optional[Exception] = None
    for mirror in MIRRORS:
        for attempt in range(tries_per_mirror):
            try:
                req = urllib.request.Request(
                    mirror, data=urllib.parse.urlencode({"data": query}).encode(),
                    headers={"User-Agent": USER_AGENT})
                with urllib.request.urlopen(req, timeout=240) as resp:
                    return json.loads(resp.read().decode("utf-8"))
            except Exception as exc:       # network / rate limit / timeout -> try next
                last = exc
                time.sleep(2 + attempt * 3)
    raise RuntimeError(f"Overpass download failed: {last}")


def _tiles(bounds, nx: int = 2, ny: int = 3, pad: float = 0.004):
    (w, s), (e, n) = bounds
    dx, dy = (e - w) / nx, (n - s) / ny
    for i in range(nx):
        for j in range(ny):
            yield (s + j * dy - pad, w + i * dx - pad, s + (j + 1) * dy + pad, w + (i + 1) * dx + pad)


def download_and_build(progress=lambda p, m: None) -> Dict[str, Any]:
    meta = json.load(open(os.path.join(DATA_DIR, "meta.json"), "r", encoding="utf-8"))
    polys = _load_outline()
    tiles = list(_tiles(meta["bounds"]))
    seen_way = set()
    elements: List[Dict[str, Any]] = []
    for k, (s, w, n, e) in enumerate(tiles):
        progress(0.05 + 0.75 * k / len(tiles), f"Downloading OpenStreetMap roads (tile {k + 1}/{len(tiles)})")
        q = (f'[out:json][timeout:240];way["highway"~"^({HIGHWAYS})$"]({s:.5f},{w:.5f},{n:.5f},{e:.5f});out geom;')
        data = _post_overpass(q)
        for el in data.get("elements", []):
            if el.get("type") == "way" and el["id"] not in seen_way:
                seen_way.add(el["id"])
                elements.append(el)
    progress(0.85, f"Building road graph from {len(elements):,} road ways")
    net = build_network(elements, polys)
    net["fetched_at"] = time.strftime("%Y-%m-%dT%H:%M:%S%z")
    net["attribution"] = "(c) OpenStreetMap contributors, ODbL"
    return net


def _save(net: Dict[str, Any]):
    path = os.path.join(DATA_DIR, "roads_osm.json")
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(net, fh, separators=(",", ":"))
    os.replace(tmp, path)


def start_background_import(on_done=None) -> bool:
    """Start the download in a background thread.  Returns False if one is already running."""
    global _thread
    if _thread and _thread.is_alive():
        return False

    def run():
        STATE.update(state="running", message="Starting download", progress=0.02, error=None,
                     started=time.time(), finished=None)
        try:
            def prog(p, m):
                STATE.update(progress=round(p, 3), message=m)
            net = download_and_build(prog)
            _save(net)
            STATE.update(state="done", progress=1.0, finished=time.time(), nodes=len(net["nodes"]),
                         edges=len(net["edges"]), message=f"{len(net['edges']):,} road segments loaded")
            if on_done:
                on_done()
        except Exception as exc:
            STATE.update(state="error", error=str(exc), finished=time.time(),
                         message="Download failed - using the approximate network")

    _thread = threading.Thread(target=run, daemon=True, name="osm-import")
    _thread.start()
    return True


def osm_file_exists() -> bool:
    return os.path.exists(os.path.join(DATA_DIR, "roads_osm.json"))


if __name__ == "__main__":
    start_background_import()
    while _thread and _thread.is_alive():
        time.sleep(1)
        print(f"{STATE['progress']*100:5.1f}%  {STATE['message']}")
    print(STATE["state"], STATE.get("error") or "")
