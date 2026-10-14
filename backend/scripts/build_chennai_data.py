"""
Build the static Chennai data files used by the app (run once, output is committed to the repo).

    python -m backend.scripts.build_chennai_data  <path-to-datameet-Municipal_Spatial_Data/Chennai>

Needs:  pip install shapely
Input : Datameet "Municipal_Spatial_Data/Chennai" (Wards.geojson, CMA.geojson) - CC BY-SA 2.5 India
Output: backend/data/chennai/{zones.geojson, outline.geojson, hotspots.json, depots.json, meta.json,
                               network_fallback.json}
"""
import json
import math
import os
import random
import sys
from collections import defaultdict

from shapely.geometry import shape, mapping, Point, MultiPoint, LineString, box, Polygon, MultiPolygon
from shapely.ops import unary_union, voronoi_diagram, transform
import shapely

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(os.path.dirname(HERE)))
from backend import chennai_seed as S  # noqa: E402

OUT = os.path.join(os.path.dirname(HERE), "data", "chennai")
ROMAN = {"I": 1, "II": 2, "III": 3, "IV": 4, "V": 5, "VI": 6, "VII": 7, "VIII": 8, "IX": 9,
         "X": 10, "XI": 11, "XII": 12, "XIII": 13, "XIV": 14, "XV": 15}
LAT0 = 13.0
KX = 111.320 * math.cos(math.radians(LAT0))   # km per degree lon
KY = 110.574                                    # km per degree lat


def to_km(geom):
    return transform(lambda x, y, z=None: (x * KX, y * KY), geom)


def area_km2(geom):
    return to_km(geom).area


def circle(lat, lng, r_km):
    p = Point(lng * KX, lat * KY).buffer(r_km, 48)
    return transform(lambda x, y, z=None: (x / KX, y / KY), p)


def haversine(a, b):
    R = 6371.0
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    d = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 2 * R * math.asin(math.sqrt(d))


def clean(geom, tol=0.00018, min_km2=0.15):
    g = geom.buffer(0)
    if g.geom_type == "MultiPolygon":
        parts = [p for p in g.geoms if area_km2(p) >= min_km2]
        g = MultiPolygon(parts) if len(parts) > 1 else parts[0]
    g = g.simplify(tol, preserve_topology=True)
    return g


def round_geom(geom, nd=5):
    gj = mapping(geom)

    def rnd(c):
        if isinstance(c[0], (int, float)):
            return [round(c[0], nd), round(c[1], nd)]
        return [rnd(x) for x in c]
    gj["coordinates"] = rnd(gj["coordinates"])
    return gj


def main(src):
    os.makedirs(OUT, exist_ok=True)
    wards = json.load(open(os.path.join(src, "Wards.geojson")))["features"]
    cma = shape(json.load(open(os.path.join(src, "CMA.geojson")))["features"][0]["geometry"]).buffer(0)

    # --- GCC zones: dissolve wards by zone (ward 0 = St Thomas Mount cantonment -> Alandur) -----
    by_zone, ward_geoms = defaultdict(list), []
    for f in wards:
        p = f["properties"]
        zn = ROMAN.get(p["Zone_No"], 12)
        g = shape(f["geometry"]).buffer(0)
        by_zone[zn].append(g)
        ward_geoms.append((p["Ward_No"] if p["Ward_No"] else 0, zn, g))
    zone_geoms = {z: unary_union(gs).buffer(0.0001).buffer(-0.0001) for z, gs in by_zone.items()}
    gcc_union = unary_union(list(zone_geoms.values())).buffer(0.0002).buffer(-0.0002)

    # --- Suburbs: real OpenStreetMap boundaries of Avadi, Tambaram and Pallavaram, trimmed so they abut the
    #     GCC zones without overlapping them.  Chrompet lies inside the Pallavaram boundary, so that boundary is
    #     split between the two town centres (approximate).
    osm = json.load(open(os.path.join(OUT, "suburb_boundaries.json")))
    gcc_cut = gcc_union.buffer(0.0004)
    sub_geoms = {}
    for k in ("AVADI", "TAMBARAM"):
        sub_geoms[k] = shape(osm[k]).buffer(0).difference(gcc_cut).buffer(0.0002).buffer(-0.0002)
    pal = shape(osm["PALLAVARAM"]).buffer(0).difference(gcc_cut)
    split_seeds = {"PALLAVARAM": (80.1530, 12.9830), "CHROMPET": (80.1462, 12.9516)}   # (lng, lat) of the split anchors
    cells = voronoi_diagram(MultiPoint(list(split_seeds.values())), envelope=box(79.9, 12.7, 80.5, 13.4))
    for k, (x, y) in split_seeds.items():
        cell = next(c for c in cells.geoms if c.contains(Point(x, y)))
        sub_geoms[k] = pal.intersection(cell).buffer(0.0002).buffer(-0.0002)

    # --- zone table --------------------------------------------------------------------------
    zones = []
    wsum = sum(area_km2(zone_geoms[z]) * S.GCC_ZONES[z]["density"] for z in S.GCC_ZONES)
    for z in sorted(S.GCC_ZONES):
        a = S.GCC_ZONES[z]
        g = clean(zone_geoms[z])
        km2 = area_km2(zone_geoms[z])
        pop = round(S.GCC_TARGET_POPULATION_2026 * km2 * a["density"] / wsum, -3)
        ws = sorted(w for (w, zn, _) in ward_geoms if zn == z and w)
        zones.append(dict(id=f"Z{z:02d}", number=z, name=a["name"], kind="gcc", g=g,
                          area_km2=round(km2, 1), pop=int(pop), coastal=a["coastal"],
                          low_lying=a["low_lying"], soil=a["soil"],
                          wards=[ws[0], ws[-1]] if ws else [0, 0]))
    for k, a in S.SUBURBS.items():
        g = clean(sub_geoms[k], min_km2=0.3)
        zones.append(dict(id=f"S-{k}", number=None, name=a["name"], kind="suburb", g=g,
                          area_km2=round(area_km2(sub_geoms[k]), 1), pop=int(a["pop_2026"]),
                          coastal=a["coastal"], low_lying=a["low_lying"], soil=a["soil"], wards=None))
    for z in zones:
        z["density"] = round(z["pop"] / max(z["area_km2"], 0.1))
        c = z["g"].representative_point()
        z["centroid"] = [round(c.y, 5), round(c.x, 5)]

    # --- write zones / outline ---------------------------------------------------------------
    feats = []
    for z in zones:
        props = {k: v for k, v in z.items() if k != "g"}
        feats.append({"type": "Feature", "properties": props, "geometry": round_geom(z["g"])})
    json.dump({"type": "FeatureCollection", "features": feats,
               "attribution": "Zone/ward geometry: Datameet / Transparent Chennai (CC BY-SA 2.5 IN). "
                              "Avadi / Tambaram / Pallavaram boundaries: OpenStreetMap contributors (ODbL); Chrompet is an approximate split of the Pallavaram boundary. Population = modelled estimate."},
              open(os.path.join(OUT, "zones.geojson"), "w"), separators=(",", ":"))
    outline = unary_union([z["g"] for z in zones]).buffer(0.0006).buffer(-0.0006)
    # sliver gaps between neighbouring zones would show up as holes in the map mask: fill every interior ring
    outline = unary_union([Polygon(p.exterior) for p in (outline.geoms if outline.geom_type == "MultiPolygon" else [outline])])
    outline = outline.simplify(0.0003, preserve_topology=True)
    json.dump({"type": "Feature", "properties": {"name": "Study area"}, "geometry": round_geom(outline)},
              open(os.path.join(OUT, "outline.geojson"), "w"), separators=(",", ":"))
    minx, miny, maxx, maxy = outline.bounds
    c = outline.centroid
    meta = dict(bounds=[[round(minx, 4), round(miny, 4)], [round(maxx, 4), round(maxy, 4)]],
                center=[round(c.x, 4), round(c.y, 4)],
                total_area_km2=round(area_km2(outline), 1),
                total_population=sum(z["pop"] for z in zones),
                zones=len(zones))
    json.dump(meta, open(os.path.join(OUT, "meta.json"), "w"), indent=1)
    print("zones:", len(zones), meta)

    # helper: locate zone/ward --------------------------------------------------------------
    def locate(lat, lng):
        p = Point(lng, lat)
        zid = next((z for z in zones if z["g"].buffer(0.0006).contains(p)), None)
        wd = next((w for (w, zn, g) in ward_geoms if g.contains(p)), None)
        return (zid["id"] if zid else None), (wd or None)

    zone_by_id = {z["id"]: z for z in zones}

    # --- hotspots ---------------------------------------------------------------------------
    hs_out, dropped = [], []
    for (hid, name, lat, lng, sev, r, src_) in S.HOTSPOTS:
        zid, wd = locate(lat, lng)
        if not zid:
            dropped.append(name)
            continue
        z = zone_by_id[zid]
        km2 = math.pi * (r / 1000.0) ** 2
        exposed = min(km2 * z["density"] * 0.6, 0.30 * z["pop"])
        hs_out.append(dict(id=hid, name=name, lat=lat, lng=lng, severity=sev, radius_m=r, source=src_,
                           zone=zid, ward=wd, exposed_pop=int(round(exposed, -2))))
    json.dump(hs_out, open(os.path.join(OUT, "hotspots.json"), "w"), indent=1)
    print("hotspots:", len(hs_out), "dropped (outside study area):", dropped)

    # --- depots -----------------------------------------------------------------------------
    dp_out = []
    for (did, name, lat, lng, scale) in S.DEPOTS:
        zid, wd = locate(lat, lng)
        if not zid:
            print("WARNING depot outside area", name)
            continue
        m = S.SCALE_MULT[scale]
        stocks = {k: v * m for k, v in S.BASE_STOCK.items()}
        dp_out.append(dict(id=did, name=name, lat=lat, lng=lng, scale=scale, zone=zid, ward=wd,
                           stocks=stocks, placeholder=True))
    json.dump(dp_out, open(os.path.join(OUT, "depots.json"), "w"), indent=1)
    print("depots:", len(dp_out))

    # --- approximate fallback road network (used until real OSM roads are downloaded) ---------
    build_fallback(outline, hs_out, dp_out, zones)


def build_fallback(outline, hotspots, depots, zones):
    random.seed(7)
    land = outline.buffer(-0.0015)
    pts = [(h["lng"], h["lat"]) for h in hotspots] + [(d["lng"], d["lat"]) for d in depots]
    pts += [(z["centroid"][1], z["centroid"][0]) for z in zones]
    minx, miny, maxx, maxy = outline.bounds
    spacing = 1.55  # km
    tries = 0
    while tries < 9000:
        tries += 1
        x, y = random.uniform(minx, maxx), random.uniform(miny, maxy)
        if not land.contains(Point(x, y)):
            continue
        if all(math.hypot((x - px) * KX, (y - py) * KY) >= spacing for (px, py) in pts):
            pts.append((x, y))
    tris = shapely.delaunay_triangles(MultiPoint(pts))
    edges = set()
    key = {}
    for i, p in enumerate(pts):
        key[(round(p[0], 7), round(p[1], 7))] = i
    for t in tris.geoms:
        c = list(t.exterior.coords)[:3]
        ids = [key.get((round(x, 7), round(y, 7))) for (x, y) in c]
        for a, b in ((0, 1), (1, 2), (2, 0)):
            ia, ib = ids[a], ids[b]
            if ia is None or ib is None or ia == ib:
                continue
            edges.add((min(ia, ib), max(ia, ib)))
    nodes = {i: (pts[i][1], pts[i][0]) for i in range(len(pts))}
    good = []
    inland = outline.buffer(0.0012)
    for (a, b) in edges:
        la, lb = nodes[a], nodes[b]
        d = haversine(la, lb)
        if d > 5.2:
            continue
        seg = LineString([(la[1], la[0]), (lb[1], lb[0])])
        if not inland.contains(seg):
            continue
        good.append((a, b, d))
    # keep largest connected component
    adj = defaultdict(list)
    for a, b, d in good:
        adj[a].append(b)
        adj[b].append(a)
    seen, comps = set(), []
    for n in nodes:
        if n in seen or n not in adj:
            continue
        stack, comp = [n], []
        seen.add(n)
        while stack:
            u = stack.pop()
            comp.append(u)
            for v in adj[u]:
                if v not in seen:
                    seen.add(v)
                    stack.append(v)
        comps.append(comp)
    main_comp = set(max(comps, key=len))
    remap = {old: new for new, old in enumerate(sorted(main_comp))}
    out_nodes = [[remap[o], round(nodes[o][0], 5), round(nodes[o][1], 5)] for o in sorted(main_comp)]
    out_edges = []
    for a, b, d in good:
        if a in main_comp and b in main_comp:
            km = round(d * 1.28, 3)          # detour factor: straight line -> road length
            cls = "primary" if km > 3.2 else ("secondary" if km > 1.9 else "tertiary")
            out_edges.append([remap[a], remap[b], km, cls, "Approximate link", 0])
    json.dump({"source": "fallback", "nodes": out_nodes, "edges": out_edges},
              open(os.path.join(OUT, "network_fallback.json"), "w"), separators=(",", ":"))
    print("fallback network: nodes", len(out_nodes), "edges", len(out_edges))


if __name__ == "__main__":
    main(sys.argv[1])
