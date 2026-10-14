"""
Road network model for Chennai + classical A* search on it.

* The network is a graph of junction nodes and road-segment edges.  It is loaded from
  ``data/chennai/roads_osm.json`` (real OpenStreetMap roads, downloaded on first run) or, until
  that exists, from ``data/chennai/network_fallback.json`` (an approximate network).
* Edge state (open / slow / blocked) is derived from live hazard scores around flood hotspots and
  from manual blocks set by the operator.
* ``astar`` is a textbook A* (priority queue, closed set, admissible haversine / v_max heuristic)
  that works on travel-TIME cost, so a route is the fastest one given today's flooding.
  No machine learning is used anywhere.
"""
from __future__ import annotations

import heapq
import json
import math
import os
import threading
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "chennai")

# Free-flow truck speeds (km/h) by road class in Chennai traffic conditions
CLASS_SPEED = {
    "motorway": 55.0, "trunk": 42.0, "primary": 34.0, "secondary": 28.0,
    "tertiary": 24.0, "residential": 18.0, "access": 15.0,
}
MAJOR = {"motorway", "trunk", "primary"}
V_MAX = max(CLASS_SPEED.values())


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0088
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = p2 - p1
    dl = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


@dataclass
class Edge:
    idx: int
    a: int
    b: int
    km: float
    cls: str
    name: str
    oneway: int          # 0 two-way, 1 a->b only
    geom: List[List[float]]  # [[lat,lng],...] from a to b
    mid: Tuple[float, float] = (0.0, 0.0)
    # dynamic state
    status: str = "open"       # open | slow | blocked
    factor: float = 1.0        # speed multiplier (1 = free flow)
    reason: str = ""
    manual: bool = False

    @property
    def speed(self) -> float:
        return CLASS_SPEED.get(self.cls, 18.0) * self.factor

    @property
    def hours(self) -> float:
        if self.status == "blocked":
            return math.inf
        return self.km / max(self.speed, 1.0)


@dataclass
class AStarOutcome:
    found: bool
    nodes: List[int] = field(default_factory=list)
    edges: List[int] = field(default_factory=list)       # edge idx (negative = virtual snap edge)
    km: float = 0.0
    hours: float = 0.0
    expanded: int = 0
    trace: Optional[List[List[float]]] = None             # [[lat,lng,g,h,open,closed], ...]


class RoadNetwork:
    """In-memory road graph with dynamic edge state."""

    def __init__(self, nodes: List[Tuple[float, float]], edges: List[Edge], source: str, meta: Dict[str, Any] | None = None):
        self.nodes = nodes                    # idx -> (lat, lng)
        self.edges = edges
        self.source = source                  # "osm" | "fallback"
        self.meta = meta or {}
        self.version = 0                      # bumped whenever edge state changes
        self._lock = threading.RLock()
        self.adj: List[List[Tuple[int, int]]] = [[] for _ in nodes]   # node -> [(nbr, edge_idx)]
        for e in edges:
            self.adj[e.a].append((e.b, e.idx))
            if not e.oneway:
                self.adj[e.b].append((e.a, e.idx))
        self._build_indexes()

    # ------------------------------------------------------------------ loading
    @classmethod
    def load(cls, data_dir: str = DATA_DIR, prefer_osm: bool = True) -> "RoadNetwork":
        osm = os.path.join(data_dir, "roads_osm.json")
        fb = os.path.join(data_dir, "network_fallback.json")
        path, src = (osm, "osm") if (prefer_osm and os.path.exists(osm)) else (fb, "fallback")
        try:
            return cls.from_file(path, src)
        except Exception:
            if src == "osm":                       # corrupt download -> fall back
                return cls.from_file(fb, "fallback")
            raise

    @classmethod
    def from_file(cls, path: str, src: str) -> "RoadNetwork":
        with open(path, "r", encoding="utf-8") as fh:
            data = json.load(fh)
        nodes: List[Tuple[float, float]] = [None] * len(data["nodes"])  # type: ignore
        for (i, lat, lng) in data["nodes"]:
            nodes[i] = (lat, lng)
        edges: List[Edge] = []
        for k, row in enumerate(data["edges"]):
            a, b, km, c, name, ow = row[:6]
            geom = row[6] if len(row) > 6 and row[6] else [list(nodes[a]), list(nodes[b])]
            edges.append(Edge(k, a, b, float(km), c, name or "", int(ow), geom))
        meta = {k: v for k, v in data.items() if k not in ("nodes", "edges")}
        return cls(nodes, edges, data.get("source", src), meta)

    # ------------------------------------------------------------------ spatial index
    def _build_indexes(self):
        self.cell = 0.01   # ~1.1 km grid
        self.node_grid: Dict[Tuple[int, int], List[int]] = {}
        for i, (lat, lng) in enumerate(self.nodes):
            self.node_grid.setdefault((int(lat / self.cell), int(lng / self.cell)), []).append(i)
        self.edge_grid: Dict[Tuple[int, int], List[int]] = {}
        for e in self.edges:
            g = e.geom
            e.mid = (sum(p[0] for p in g) / len(g), sum(p[1] for p in g) / len(g)) if len(g) <= 2 else tuple(g[len(g) // 2])  # type: ignore
            for (lat, lng) in {(p[0], p[1]) for p in g[:: max(1, len(g) // 6)]} | {tuple(g[-1])}:  # sampled vertices
                self.edge_grid.setdefault((int(lat / self.cell), int(lng / self.cell)), []).append(e.idx)

    def nearest_nodes(self, lat: float, lng: float, k: int = 2, max_km: float = 6.0) -> List[Tuple[int, float]]:
        cx, cy = int(lat / self.cell), int(lng / self.cell)
        found: List[Tuple[float, int]] = []
        for ring in range(1, 40):
            for dx in range(-ring, ring + 1):
                for dy in range(-ring, ring + 1):
                    if max(abs(dx), abs(dy)) != ring and ring > 1:
                        continue
                    for n in self.node_grid.get((cx + dx, cy + dy), []):
                        d = haversine_km(lat, lng, *self.nodes[n])
                        found.append((d, n))
            if len(found) >= k and ring >= 2:
                break
        found.sort()
        return [(n, d) for (d, n) in found[:k] if d <= max_km]

    def nearest_edge(self, lat: float, lng: float, max_m: float = 450.0) -> Optional[Tuple[Edge, float]]:
        cx, cy = int(lat / self.cell), int(lng / self.cell)
        best: Optional[Tuple[float, Edge]] = None
        seen = set()
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for ei in self.edge_grid.get((cx + dx, cy + dy), []):
                    if ei in seen:
                        continue
                    seen.add(ei)
                    e = self.edges[ei]
                    d = _dist_to_polyline_m(lat, lng, e.geom)
                    if best is None or d < best[0]:
                        best = (d, e)
        if best and best[0] <= max_m:
            return best[1], best[0]
        return None

    def edges_near(self, lat: float, lng: float, radius_m: float) -> List[Tuple[Edge, float]]:
        r_cells = int(radius_m / 1000.0 / 1.1) + 1
        cx, cy = int(lat / self.cell), int(lng / self.cell)
        out, seen = [], set()
        for dx in range(-r_cells, r_cells + 1):
            for dy in range(-r_cells, r_cells + 1):
                for ei in self.edge_grid.get((cx + dx, cy + dy), []):
                    if ei in seen:
                        continue
                    seen.add(ei)
                    e = self.edges[ei]
                    d = haversine_km(lat, lng, *e.mid) * 1000.0
                    if d <= radius_m:
                        out.append((e, d))
        return out

    # ------------------------------------------------------------------ edge state
    def reset_state(self, keep_manual: bool = True):
        with self._lock:
            for e in self.edges:
                if keep_manual and e.manual:
                    continue
                e.status, e.factor, e.reason, e.manual = "open", 1.0, "", False
            self.version += 1

    def apply_hazards(self, hotspot_intensity: List[Tuple[Dict[str, Any], float]]):
        """hotspot_intensity: [(hotspot, local flood intensity 0..1)].  Slows / blocks nearby roads."""
        with self._lock:
            for e in self.edges:
                if not e.manual:
                    e.status, e.factor, e.reason = "open", 1.0, ""
            for hs, inten in hotspot_intensity:
                if inten < 0.30:
                    continue
                sev = hs["severity"]
                radius = float(hs["radius_m"])
                for e, d in self.edges_near(hs["lat"], hs["lng"], radius):
                    if e.manual:
                        continue
                    closeness = 1.0 - 0.45 * (d / radius)
                    sl = max(0.18, 1.0 - 0.85 * min(1.0, (inten - 0.2) / 0.7) * closeness)
                    if sl < e.factor:
                        e.factor = round(sl, 3)
                        e.status = "slow"
                        e.reason = f"Flooding near {hs['name']}"
                    # inundated low-lying minor roads in severe hotspots become impassable
                    if inten >= 0.82 and sev >= 3 and e.cls not in MAJOR and d <= 0.65 * radius:
                        e.status = "blocked"
                        e.factor = 0.0
                        e.reason = f"Inundated near {hs['name']}"
            self.version += 1

    def set_manual(self, edge_idx: int, blocked: bool, reason: str = "Blocked by operator"):
        with self._lock:
            e = self.edges[edge_idx]
            if blocked:
                e.status, e.factor, e.reason, e.manual = "blocked", 0.0, reason, True
            else:
                e.status, e.factor, e.reason, e.manual = "open", 1.0, "", False
            self.version += 1

    def state_counts(self) -> Dict[str, int]:
        c = {"open": 0, "slow": 0, "blocked": 0}
        for e in self.edges:
            c[e.status] += 1
        return c

    def overlay_geojson(self) -> Dict[str, Any]:
        feats = []
        for e in self.edges:
            if e.status == "open":
                continue
            feats.append({
                "type": "Feature",
                "properties": {"id": e.idx, "status": e.status, "factor": e.factor, "name": e.name,
                               "cls": e.cls, "reason": e.reason, "manual": e.manual},
                "geometry": {"type": "LineString", "coordinates": [[p[1], p[0]] for p in e.geom]},
            })
        return {"type": "FeatureCollection", "features": feats}

    # ------------------------------------------------------------------ routing graph
    def routing_graph(self, points: Dict[str, Tuple[float, float]]) -> "RoutingGraph":
        return RoutingGraph(self, points)


class RoutingGraph:
    """Road network + virtual nodes (depots / affected areas) joined by access links."""

    ACCESS_KMH = 15.0

    def __init__(self, net: RoadNetwork, points: Dict[str, Tuple[float, float]]):
        self.net = net
        self.version = net.version
        base_n = len(net.nodes)
        self.coords: List[Tuple[float, float]] = list(net.nodes)
        self.adj: List[List[Tuple[int, int]]] = [list(a) for a in net.adj]
        self.virt_edges: List[Tuple[int, int, float, List[List[float]]]] = []   # (a, b, km, geom)
        self.id_to_node: Dict[str, int] = {}
        self.node_to_id: Dict[int, str] = {}
        for pid, (lat, lng) in points.items():
            idx = len(self.coords)
            self.coords.append((lat, lng))
            self.adj.append([])
            self.id_to_node[pid] = idx
            self.node_to_id[idx] = pid
            for (n, d) in net.nearest_nodes(lat, lng, k=2):
                km = max(d * 1.2, 0.03)
                ve = len(self.virt_edges)
                self.virt_edges.append((idx, n, km, [[lat, lng], list(net.nodes[n])]))
                eid = -(ve + 1)
                self.adj[idx].append((n, eid))
                self.adj[n].append((idx, eid))
        self.base_n = base_n
        self.vmax = self._vmax()

    def _vmax(self) -> float:
        m = 0.0
        for e in self.net.edges:
            if e.status != "blocked":
                s = e.speed
                if s > m:
                    m = s
        return max(m, self.ACCESS_KMH, 10.0)

    def edge_cost(self, eid: int) -> Tuple[float, float]:
        """(km, hours) of an edge id (negative = virtual)."""
        if eid < 0:
            km = self.virt_edges[-eid - 1][2]
            return km, km / self.ACCESS_KMH
        e = self.net.edges[eid]
        return e.km, e.hours

    def edge_geom(self, eid: int, from_node: int) -> List[List[float]]:
        if eid < 0:
            a, b, _, g = self.virt_edges[-eid - 1]
            return g if from_node == a else list(reversed(g))
        e = self.net.edges[eid]
        return e.geom if from_node == e.a else list(reversed(e.geom))

    def astar(self, start: str | int, goal: str | int, trace: bool = False, trace_limit: int = 9000) -> AStarOutcome:
        s = self.id_to_node[start] if isinstance(start, str) else start
        g_ = self.id_to_node[goal] if isinstance(goal, str) else goal
        if s == g_:
            return AStarOutcome(True, [s], [], 0.0, 0.0, 0)
        coords, adj = self.coords, self.adj
        glat, glng = coords[g_]
        vmax = self.vmax
        INF = math.inf

        def h(n: int) -> float:
            la, lo = coords[n]
            return haversine_km(la, lo, glat, glng) / vmax

        gs: Dict[int, float] = {s: 0.0}
        came: Dict[int, Tuple[int, int]] = {}
        openh: List[Tuple[float, int]] = [(h(s), s)]
        closed = set()
        tr: Optional[List[List[float]]] = [] if trace else None
        expanded = 0
        while openh:
            f, u = heapq.heappop(openh)
            if u in closed:
                continue
            closed.add(u)
            expanded += 1
            if tr is not None and len(tr) < trace_limit:
                tr.append([round(coords[u][0], 6), round(coords[u][1], 6), round(gs[u], 4),
                           round(f - gs[u], 4), len(openh), len(closed)])
            if u == g_:
                break
            gu = gs[u]
            for (v, eid) in adj[u]:
                if v in closed:
                    continue
                if eid >= 0:
                    e = self.net.edges[eid]
                    if e.status == "blocked":
                        continue
                    if e.oneway and e.a != u:
                        continue
                    c = e.km / max(e.speed, 1.0)
                else:
                    c = self.virt_edges[-eid - 1][2] / self.ACCESS_KMH
                ng = gu + c
                if ng < gs.get(v, INF):
                    gs[v] = ng
                    came[v] = (u, eid)
                    heapq.heappush(openh, (ng + h(v), v))
        if g_ not in closed:
            return AStarOutcome(False, expanded=expanded, trace=tr)
        nodes, eds = [g_], []
        cur = g_
        km = 0.0
        while cur != s:
            p, eid = came[cur]
            eds.append(eid)
            km += self.edge_cost(eid)[0]
            nodes.append(p)
            cur = p
        nodes.reverse()
        eds.reverse()
        return AStarOutcome(True, nodes, eds, round(km, 3), round(gs[g_], 4), expanded, tr)

    def path_geometry(self, out: AStarOutcome) -> List[List[float]]:
        """Polyline [[lng, lat], ...] of the route."""
        pts: List[List[float]] = []
        for i, eid in enumerate(out.edges):
            seg = self.edge_geom(eid, out.nodes[i])
            for p in seg:
                q = [round(p[1], 6), round(p[0], 6)]
                if not pts or pts[-1] != q:
                    pts.append(q)
        if not pts and out.nodes:
            la, lo = self.coords[out.nodes[0]]
            pts = [[lo, la]]
        return pts

    def route_segments(self, out: AStarOutcome) -> List[Dict[str, Any]]:
        """Per-edge details (name, class, state) - used for the turn list."""
        segs = []
        for i, eid in enumerate(out.edges):
            if eid < 0:
                km, hrs = self.edge_cost(eid)
                segs.append({"name": "Access road", "cls": "access", "km": round(km, 2), "hours": hrs, "status": "open"})
            else:
                e = self.net.edges[eid]
                segs.append({"name": e.name, "cls": e.cls, "km": round(e.km, 3),
                             "hours": e.hours, "status": e.status})
        return segs


def _dist_to_polyline_m(lat: float, lng: float, geom: List[List[float]]) -> float:
    kx = 111320.0 * math.cos(math.radians(lat))
    ky = 110574.0
    best = math.inf
    for i in range(len(geom) - 1):
        ax, ay = (geom[i][1] - lng) * kx, (geom[i][0] - lat) * ky
        bx, by = (geom[i + 1][1] - lng) * kx, (geom[i + 1][0] - lat) * ky
        dx, dy = bx - ax, by - ay
        L2 = dx * dx + dy * dy
        t = 0.0 if L2 == 0 else max(0.0, min(1.0, -(ax * dx + ay * dy) / L2))
        px, py = ax + t * dx, ay + t * dy
        d = math.hypot(px, py)
        if d < best:
            best = d
    return best
