"""
Service layer: scenarios, hazard sync, dispatch planning (A* + Genetic Algorithm), A* explanation.
Classical AI only - A* search for routing, a genetic algorithm for assignment.
"""
from __future__ import annotations

import json
import math
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from . import models, schemas, runtime, relief
from . import chennai_data as cd
from .algorithms.genetic import GeneticAlgorithmOptimizer, RESOURCE_KEYS, SEVERITY_WEIGHTS
from .hazards import ENGINE, IST, hotspot_intensities
from .scenarios import SCENARIOS, build_hazard_state

DWELL_HOURS = 0.30          # unloading / hand-over time at each stop
SPEED_REF_KMH = 36.0        # reference truck speed that road-class speeds are calibrated to
SPLIT_CHUNK = 5000          # large demands are split into deliveries of at most this many units


# ------------------------------------------------------------------------------------------
# App state helpers
# ------------------------------------------------------------------------------------------
def _get_state(db: Session, key: str, default: str = "") -> str:
    row = db.get(models.AppState, key)
    return row.value if row else default


def _set_state(db: Session, key: str, value: str):
    row = db.get(models.AppState, key)
    if row:
        row.value = value
    else:
        db.add(models.AppState(key=key, value=value))
    db.commit()


def active_scenario_key(db: Session) -> str:
    k = _get_state(db, "scenario", "live")
    return k if k in SCENARIOS else "live"


# ------------------------------------------------------------------------------------------
# Scenarios & hazard sync
# ------------------------------------------------------------------------------------------
def seed_database_if_empty(db: Session, default_scenario: str = "live"):
    if db.query(models.Warehouse).count() == 0:
        load_scenario_into_db(db, default_scenario)
    else:
        key = active_scenario_key(db)
        ENGINE.set_scenario(key if key != "live" else None, build_hazard_state(key))
        restore_road_blocks(db)
        runtime.apply_hazards()


def load_scenario_into_db(db: Session, scenario_key: str) -> Dict[str, Any]:
    if scenario_key not in SCENARIOS:
        scenario_key = "live"
    sc = SCENARIOS[scenario_key]
    ENGINE.set_scenario(None if sc["kind"] == "live" else scenario_key, build_hazard_state(scenario_key))

    db.query(models.Truck).delete()
    db.query(models.AffectedArea).delete()
    db.query(models.Warehouse).delete()
    db.commit()
    for w in relief.default_warehouses(sc.get("stock_mult", 1.0)):
        db.add(models.Warehouse(**w))
    for t in relief.default_trucks():
        db.add(models.Truck(**t))
    db.commit()
    _set_state(db, "scenario", scenario_key)
    runtime.ROAD.reset_state(keep_manual=True)
    n = sync_areas_from_hazards(db)
    return {"success": True, "scenario_key": scenario_key, "name": sc["name"], "description": sc["description"],
            "affected_areas": n}


def sync_areas_from_hazards(db: Session) -> int:
    """Re-derive affected areas from the active hazard scores (operator-entered areas are kept)."""
    scores = ENGINE.scores()
    ints = hotspot_intensities(scores)
    derived = relief.derive_affected_areas(scores, ints)
    db.query(models.AffectedArea).filter(models.AffectedArea.manual.is_(False)).delete()
    for a in derived:
        db.add(models.AffectedArea(manual=False, **a))
    db.commit()
    runtime.apply_hazards()
    return len(derived)


def restore_road_blocks(db: Session):
    sig = runtime.network_signature()
    rows = db.query(models.RoadBlock).all()
    for r in rows:
        if r.network_signature == sig and 0 <= r.edge_index < len(runtime.ROAD.edges):
            runtime.ROAD.set_manual(r.edge_index, True, r.reason)
        else:
            db.delete(r)
    db.commit()


def block_edge(db: Session, edge_idx: int, reason: str) -> Dict[str, Any]:
    road = runtime.ROAD
    if not (0 <= edge_idx < len(road.edges)):
        raise KeyError("edge not found")
    e = road.edges[edge_idx]
    road.set_manual(edge_idx, True, reason)
    db.query(models.RoadBlock).filter(models.RoadBlock.edge_index == edge_idx).delete()
    db.add(models.RoadBlock(edge_index=edge_idx, network_signature=runtime.network_signature(), name=e.name,
                            lat=e.mid[0], lng=e.mid[1], reason=reason))
    db.commit()
    return {"id": edge_idx, "status": "blocked", "name": e.name}


def unblock_edge(db: Session, edge_idx: int) -> Dict[str, Any]:
    road = runtime.ROAD
    if not (0 <= edge_idx < len(road.edges)):
        raise KeyError("edge not found")
    road.set_manual(edge_idx, False)
    db.query(models.RoadBlock).filter(models.RoadBlock.edge_index == edge_idx).delete()
    db.commit()
    runtime.apply_hazards()
    return {"id": edge_idx, "status": road.edges[edge_idx].status}


# ------------------------------------------------------------------------------------------
# Dashboard / state
# ------------------------------------------------------------------------------------------
def get_dashboard_statistics(db: Session) -> schemas.DashboardStats:
    warehouses = db.query(models.Warehouse).filter(models.Warehouse.active.is_(True)).all()
    affected = db.query(models.AffectedArea).all()
    trucks = db.query(models.Truck).all()
    latest = db.query(models.DistributionPlan).order_by(models.DistributionPlan.created_at.desc()).first()

    def tot(rows, attr):
        return sum(getattr(r, attr) for r in rows)

    return schemas.DashboardStats(
        total_warehouses=len(warehouses),
        total_affected_locations=len(affected),
        available_trucks=sum(1 for t in trucks if t.status == "Available"),
        busy_trucks=sum(1 for t in trucks if t.status == "Busy"),
        total_trucks=len(trucks),
        pending_requests_count=len(affected),
        total_resources_stock=schemas.ResourceBundle(
            food=tot(warehouses, "food_stock"), water=tot(warehouses, "water_stock"),
            medicine=tot(warehouses, "medicine_stock"), blankets=tot(warehouses, "blanket_stock"),
            emergency_kits=tot(warehouses, "emergency_kit_stock")),
        total_resources_demand=schemas.ResourceBundle(
            food=tot(affected, "food_demand"), water=tot(affected, "water_demand"),
            medicine=tot(affected, "medicine_demand"), blankets=tot(affected, "blanket_demand"),
            emergency_kits=tot(affected, "emergency_kit_demand")),
        total_travel_distance_km=latest.total_distance_km if latest else 0.0,
        estimated_fuel_usage_liters=latest.total_fuel_liters if latest else 0.0,
        overall_delivery_efficiency_pct=latest.overall_efficiency_pct if latest else 0.0,
        coverage_percentage=latest.coverage_pct if latest else 0.0,
    )


def build_state(db: Session) -> Dict[str, Any]:
    from . import osm_import
    key = active_scenario_key(db)
    sc = SCENARIOS[key]
    snap = ENGINE.snapshot()
    road = runtime.ROAD
    latest = db.query(models.DistributionPlan).order_by(models.DistributionPlan.created_at.desc()).first()
    latest_info = None
    if latest:
        latest_info = {"id": latest.id, "created_at": latest.created_at.isoformat(), "name": latest.name,
                       "coverage_pct": latest.coverage_pct, "total_distance_km": latest.total_distance_km,
                       "total_time_hours": latest.total_travel_time_hours}
    return {
        "scenario": {"key": key, "name": sc["name"], "kind": sc["kind"], "description": sc["description"]},
        "hazard": snap,
        "warehouses": [w.to_dict() for w in db.query(models.Warehouse).all()],
        "affected_areas": [a.to_dict() for a in db.query(models.AffectedArea).all()],
        "trucks": [t.to_dict() for t in db.query(models.Truck).all()],
        "network": {"source": road.source, "nodes": len(road.nodes), "edges": len(road.edges),
                    "state": road.state_counts(), "version": road.version, "import": osm_import.STATE,
                    "fetched_at": road.meta.get("fetched_at")},
        "stats": get_dashboard_statistics(db).model_dump(),
        "latest_plan": latest_info,
    }


# ------------------------------------------------------------------------------------------
# Dispatch planning
# ------------------------------------------------------------------------------------------
class LazyPathMatrix:
    """dict-like (u, v) -> path info, each entry computed on demand with A* on the road graph."""

    def __init__(self, rg, base_of, cache: Dict[Tuple, Dict[str, Any]], version: int):
        self.rg, self.base_of, self.cache, self.version = rg, base_of, cache, version
        self.searches = 0

    def __contains__(self, key) -> bool:
        return True

    def __getitem__(self, key):
        u, v = self.base_of.get(key[0], key[0]), self.base_of.get(key[1], key[1])
        if u == v:
            return {"found": True, "distance": 0.0, "time": 0.0, "fuel": 0.0, "path": [key[0], key[1]]}
        ck = (self.version, u, v, self.rg.coords[self.rg.id_to_node[u]], self.rg.coords[self.rg.id_to_node[v]])
        hit = self.cache.get(ck)
        if hit is None:
            out = self.rg.astar(u, v)
            self.searches += 1
            hit = {"found": out.found, "distance": out.km if out.found else 9999.0,
                   "time": out.hours if out.found else 999.0, "fuel": 0.0}
            self.cache[ck] = hit
            if len(self.cache) > 20000:
                self.cache.clear()
        return {**hit, "path": [key[0], key[1]]}


_PATH_CACHE: Dict[Tuple, Dict[str, Any]] = {}


def _clock(base: datetime, hours: float) -> str:
    return (base + timedelta(hours=hours)).isoformat(timespec="minutes")


def _split_demands(areas: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], Dict[str, str]]:
    """Split very large demands into several deliveries so any truck can carry one."""
    out, base_of = [], {}
    for a in areas:
        total = sum(a["demands"].get(k, 0) for k in RESOURCE_KEYS)
        n = max(1, math.ceil(total / SPLIT_CHUNK))
        if n == 1:
            out.append(a)
            base_of[a["id"]] = a["id"]
            continue
        for i in range(n):
            part = {k: (a["demands"].get(k, 0) // n) + (1 if i < a["demands"].get(k, 0) % n else 0) for k in RESOURCE_KEYS}
            sid = f"{a['id']}#{i + 1}"
            sub = {**a, "id": sid, "name": f"{a['name']} ({i + 1}/{n})", "demands": part, "base_id": a["id"]}
            out.append(sub)
            base_of[sid] = a["id"]
    return out, base_of


def generate_distribution_plan(db: Session, request: schemas.PlanGenerationRequest) -> schemas.DistributionPlanResponse:
    t0 = time.time()
    warehouses_db = db.query(models.Warehouse).filter(models.Warehouse.active.is_(True)).all()
    affected_db = db.query(models.AffectedArea).all()
    trucks_db = db.query(models.Truck).all()
    warnings: List[str] = []
    if not warehouses_db:
        warnings.append("No active depots - add or activate a depot.")
    if not affected_db:
        warnings.append("No affected areas right now - nothing to dispatch.")
    if not any(t.status == "Available" for t in trucks_db):
        warnings.append("No trucks available.")

    wh_list = [w.to_dict() for w in warehouses_db]
    all_areas = [a.to_dict() for a in affected_db]
    all_areas.sort(key=lambda a: SEVERITY_WEIGHTS.get(a["severity"], 1.0) * math.log10(a["people_affected"] + 10) * (1 + a["risk_score"] / 100),
                   reverse=True)
    areas = all_areas[: request.max_areas]
    if len(all_areas) > len(areas):
        warnings.append(f"{len(all_areas) - len(areas)} lower-priority areas were left out of this plan "
                        f"(limit {request.max_areas}).")
    wh_ids = {w["id"] for w in wh_list}
    truck_list = [t.to_dict() for t in trucks_db if t.current_warehouse_id in wh_ids]

    road = runtime.ROAD
    split_areas, base_of = _split_demands(areas)
    points = {w["id"]: (w["lat"], w["lng"]) for w in wh_list}
    points.update({a["id"]: (a["lat"], a["lng"]) for a in areas})
    rg = road.routing_graph(points)
    matrix = LazyPathMatrix(rg, base_of, _PATH_CACHE, road.version)

    # unreachable check (A*): can some depot reach this area?
    reachable = []
    for a in areas:
        ok = False
        for w in sorted(wh_list, key=lambda w: (w["lat"] - a["lat"]) ** 2 + (w["lng"] - a["lng"]) ** 2)[:4]:
            if matrix[(w["id"], a["id"])]["found"]:
                ok = True
                break
        if not ok:
            warnings.append(f"'{a['name']}' ({a['severity']}) is cut off - no open road from nearby depots.")
        reachable.append(ok)

    ga = GeneticAlgorithmOptimizer(
        warehouses=wh_list, affected_areas=split_areas, trucks=truck_list, shortest_path_matrix=matrix,
        population_size=request.population_size, generations=request.generations,
        mutation_rate=request.mutation_rate, crossover_rate=request.crossover_rate)
    res = ga.run()

    plan_start = datetime.now(IST).replace(second=0, microsecond=0)
    area_by_id = {a["id"]: a for a in areas}
    wh_map = {w["id"]: w for w in wh_list}
    truck_map = {t["id"]: t for t in truck_list}
    delivered_by_area: Dict[str, Dict[str, int]] = {a["id"]: {k: 0 for k in RESOURCE_KEYS} for a in areas}
    first_eta: Dict[str, float] = {}
    depot_usage: Dict[str, Dict[str, int]] = {}
    truck_outputs: List[schemas.TruckPlanOutput] = []
    tot_km = tot_fuel = 0.0
    max_hours = 0.0

    for tp in res.truck_plans:
        t_info = truck_map[tp.truck_id]
        depot = wh_map[tp.warehouse_id]
        speed_scale = max(float(t_info.get("average_speed", SPEED_REF_KMH)) / SPEED_REF_KMH, 0.3)
        seq = [tp.warehouse_id]
        stop_groups: List[Tuple[str, List[str]]] = []      # (base area id, [sub stop ids])
        for sid in tp.stops:
            b = base_of.get(sid, sid)
            if stop_groups and stop_groups[-1][0] == b:
                stop_groups[-1][1].append(sid)
            else:
                stop_groups.append((b, [sid]))
        seq += [g[0] for g in stop_groups] + [tp.warehouse_id]

        t = 0.0
        legs, geom, road_names = [], [], []
        km_total = 0.0
        stops_detail: List[schemas.StopAllocation] = []
        tot_del = schemas.ResourceBundle()
        arrival_hours: Dict[str, float] = {}
        for i in range(len(seq) - 1):
            u, v = seq[i], seq[i + 1]
            if u == v:
                continue
            out = rg.astar(u, v)
            hrs = (out.hours if out.found else 0.0) / speed_scale
            km = out.km if out.found else 0.0
            pts = rg.path_geometry(out) if out.found else [[points[u][1], points[u][0]], [points[v][1], points[v][0]]]
            gi0 = max(len(geom) - 1, 0)
            for p in pts:
                if not geom or geom[-1] != p:
                    geom.append(p)
            gi1 = len(geom) - 1
            for sg in (rg.route_segments(out) if out.found else []):
                nm = sg["name"]
                if nm and (not road_names or road_names[-1] != nm):
                    road_names.append(nm)
            legs.append({"from": u, "to": v, "from_name": (wh_map.get(u) or area_by_id.get(u) or {}).get("name", u),
                         "to_name": (wh_map.get(v) or area_by_id.get(v) or {}).get("name", v),
                         "km": round(km, 2), "hours": round(hrs, 3), "depart_h": round(t, 3),
                         "arrive_h": round(t + hrs, 3), "found": out.found, "i0": gi0, "i1": gi1,
                         "slow_segments": sum(1 for sg in rg.route_segments(out) if sg["status"] == "slow") if out.found else 0})
            t += hrs
            km_total += km
            if v != tp.warehouse_id:
                arrival_hours[v] = t
                t += DWELL_HOURS

        for (base_id, subs) in stop_groups:
            area = area_by_id[base_id]
            deliv = {k: sum(tp.resources_allocated.get(s, {}).get(k, 0) for s in subs) for k in RESOURCE_KEYS}
            for k in RESOURCE_KEYS:
                delivered_by_area[base_id][k] += deliv[k]
                depot_usage.setdefault(tp.warehouse_id, {k2: 0 for k2 in RESOURCE_KEYS})[k] += deliv[k]
            bundle = schemas.ResourceBundle(**deliv)
            for k in RESOURCE_KEYS:
                setattr(tot_del, k, getattr(tot_del, k) + deliv[k])
            eta = arrival_hours.get(base_id, 0.0)
            first_eta[base_id] = min(first_eta.get(base_id, 1e9), eta)
            stops_detail.append(schemas.StopAllocation(
                location_id=base_id, location_name=area["name"], severity=area["severity"], delivered=bundle,
                unmet=schemas.ResourceBundle(), eta_hours=round(eta, 2), eta_clock=_clock(plan_start, eta),
                people_affected=area["people_affected"], zone_id=area.get("zone_id")))

        total_hours = t
        max_hours = max(max_hours, total_hours)
        tot_km += km_total
        fuel = km_total * float(t_info.get("fuel_consumption", 0.25))
        tot_fuel += fuel
        cap = float(t_info.get("capacity", 1000))
        load = sum(getattr(tot_del, k) for k in RESOURCE_KEYS)
        sev = "Low"
        for g in stop_groups:
            s = area_by_id[g[0]]["severity"]
            if SEVERITY_WEIGHTS.get(s, 0) > SEVERITY_WEIGHTS.get(sev, 0):
                sev = s
        truck_outputs.append(schemas.TruckPlanOutput(
            truck_id=tp.truck_id, truck_number=t_info["truck_number"], warehouse_id=tp.warehouse_id,
            warehouse_name=depot["name"], assigned_locations=[g[0] for g in stop_groups],
            assigned_location_names=[area_by_id[g[0]]["name"] for g in stop_groups], optimal_route_sequence=seq,
            optimal_route_coordinates=[[p[1], p[0]] for p in geom], distance_km=round(km_total, 2),
            estimated_time_hours=round(total_hours, 2), fuel_usage_liters=round(fuel, 1), total_load_units=float(load),
            capacity_limit=cap, capacity_utilization_pct=round(100.0 * load / max(cap, 1.0), 1),
            fuel_capacity_limit=float(t_info.get("fuel_capacity", 200)), overload_units=max(0.0, load - cap),
            fuel_overuse_liters=max(0.0, fuel - float(t_info.get("fuel_capacity", 200))),
            resources_delivered=tot_del, priority_level=sev, stops_detail=stops_detail, route_lnglat=geom, legs=legs,
            depart_clock=_clock(plan_start, 0), return_clock=_clock(plan_start, total_hours),
            total_hours=round(total_hours, 2), road_names=road_names[:40]))

    # unmet demands per real area, delivered / demanded totals
    unmet: Dict[str, Dict[str, int]] = {}
    total_dem = total_del = 0
    served_people = 0
    for a in areas:
        dem = a["demands"]
        got = delivered_by_area[a["id"]]
        u = {k: max(0, int(dem.get(k, 0)) - got[k]) for k in RESOURCE_KEYS if dem.get(k, 0) > got[k]}
        unmet[a["id"]] = u
        total_dem += sum(dem.get(k, 0) for k in RESOURCE_KEYS)
        total_del += sum(got.values())
        if sum(got.values()) >= 0.8 * sum(dem.get(k, 0) for k in RESOURCE_KEYS):
            served_people += a["people_affected"]
    for to in truck_outputs:
        for sd in to.stops_detail:
            sd.unmet = schemas.ResourceBundle(**unmet.get(sd.location_id, {}))
    served_ids = {sd.location_id for to in truck_outputs for sd in to.stops_detail}
    for a in areas:
        if a["id"] not in served_ids and reachable[areas.index(a)]:
            warnings.append(f"'{a['name']}' could not be assigned a truck (fleet or stock exhausted).")
    if total_dem > 0 and total_del < total_dem * 0.999:
        warnings.append(f"{100 * (1 - total_del / total_dem):.0f}% of requested relief could not be delivered "
                        f"(depot stock or fleet capacity).")
    coverage = round(100.0 * total_del / total_dem, 1) if total_dem else 0.0
    gen_hist = [{"generation": m.generation, "best_fitness": m.best_fitness, "avg_fitness": m.avg_fitness,
                 "worst_fitness": m.worst_fitness, "best_distance_km": m.best_distance_km,
                 "best_coverage_pct": m.best_coverage_pct} for m in res.generation_history]
    counts = road.state_counts()
    name = request.scenario_name or SCENARIOS[active_scenario_key(db)]["name"]
    eff = round(min(100.0, 0.7 * coverage + 0.3 * (100.0 * sum(1 for a in areas if a["id"] in first_eta) / max(len(areas), 1))), 1)
    summary = dict(
        truck_plans=[t.model_dump() for t in truck_outputs], generation_history=gen_hist, unmet_demands=unmet,
        algorithm_parameters=res.algorithm_parameters, warnings=warnings, depot_usage=depot_usage,
        first_eta={k: round(v, 2) for k, v in first_eta.items()}, plan_start=plan_start.isoformat(timespec="minutes"),
        network_source=road.source, blocked_roads=counts["blocked"], slow_roads=counts["slow"],
        areas_total=len(all_areas), areas_planned=len(areas), makespan_hours=round(max_hours, 2),
        people_served=served_people, total_demand_units=int(total_dem), compute_seconds=round(time.time() - t0, 1),
        a_star_searches=matrix.searches, generated_at=plan_start.isoformat(timespec="minutes"),
        message=f"Plan ready: {len(truck_outputs)} trucks, {len(areas)} areas, last delivery in {max_hours:.1f} h.",
        hazard=_hazard_note())
    rec = models.DistributionPlan(
        name=name, total_distance_km=round(tot_km, 1), total_fuel_liters=round(tot_fuel, 1),
        total_travel_time_hours=round(max_hours, 2), overall_efficiency_pct=eff, coverage_pct=coverage,
        total_resources_delivered=int(total_del), plan_data_json=json.dumps(summary))
    db.add(rec)
    db.commit()
    keep = [r.id for r in db.query(models.DistributionPlan).order_by(models.DistributionPlan.created_at.desc()).limit(15)]
    db.query(models.DistributionPlan).filter(~models.DistributionPlan.id.in_(keep)).delete(synchronize_session=False)
    db.commit()

    return schemas.DistributionPlanResponse(
        plan_id=rec.id, scenario_name=name, created_at=rec.created_at.isoformat(), total_distance_km=rec.total_distance_km,
        total_fuel_liters=rec.total_fuel_liters, total_travel_time_hours=rec.total_travel_time_hours,
        overall_efficiency_pct=eff, coverage_pct=coverage, total_resources_delivered=int(total_del),
        total_demand_units=int(total_dem), truck_plans=truck_outputs, generation_history=gen_hist, unmet_demands=unmet,
        algorithm_parameters=res.algorithm_parameters, warnings=warnings,
        message=f"Plan ready: {len(truck_outputs)} trucks, {len(areas)} areas, last delivery in {max_hours:.1f} h.",
        generated_at=plan_start.isoformat(timespec="minutes"), network_source=road.source,
        blocked_roads=counts["blocked"], slow_roads=counts["slow"], areas_total=len(all_areas),
        areas_planned=len(areas), compute_seconds=summary["compute_seconds"], a_star_searches=matrix.searches,
        depot_usage=depot_usage, first_eta=summary["first_eta"], plan_start=summary["plan_start"],
        makespan_hours=summary["makespan_hours"], people_served=served_people)


def _hazard_note() -> Dict[str, Any]:
    """Conditions the plan was made under, kept with the plan so the report can quote them later."""
    snap = ENGINE.snapshot()
    st, sm = snap["state"], snap["summary"]
    zmap = cd.zone_map()
    peak = zmap.get(sm["peak_zone"], {}).get("name", sm["peak_zone"])
    return {"label": st["label"], "mode": st["mode"], "meter": sm["meter"], "level": sm["level"],
            "peak_zone": peak, "rain24": st["rain24"], "rain72": st["rain72"],
            "gust_kmh": st["gust_kmh"], "surge_m": st["surge_m"], "quakes": len(st["quakes"]), "stale": st["stale"],
            "pop_at_risk": sm["pop_at_risk"], "zones_high": sm["zones_high"]}


# ------------------------------------------------------------------------------------------
# A* explanation (teaching view)
# ------------------------------------------------------------------------------------------
def run_astar_trace(db: Session, request: schemas.AStarVisualizerRequest) -> schemas.AStarVisualizerResponse:
    whs = {w.id: w for w in db.query(models.Warehouse).all()}
    ars = {a.id: a for a in db.query(models.AffectedArea).all()}
    ent = {**whs, **ars}
    if request.start_id not in ent or request.goal_id not in ent:
        return schemas.AStarVisualizerResponse(found=False, message="Unknown start or goal.")
    s, g = ent[request.start_id], ent[request.goal_id]
    rg = runtime.ROAD.routing_graph({s.id: (s.latitude, s.longitude), g.id: (g.latitude, g.longitude)})
    out = rg.astar(s.id, g.id, trace=True, trace_limit=7000)
    msg = (f"A* expanded {out.expanded:,} junctions and found the fastest open route: {out.km:.1f} km, "
           f"{out.hours * 60:.0f} min." if out.found else "No open route between these two places.")
    return schemas.AStarVisualizerResponse(
        found=out.found, start_name=s.name, goal_name=g.name, path_lnglat=rg.path_geometry(out) if out.found else [],
        total_distance_km=out.km, estimated_travel_time_hours=out.hours, nodes_explored_count=out.expanded,
        trace=out.trace or [], trace_truncated=out.expanded > len(out.trace or []),
        start=[s.latitude, s.longitude], goal=[g.latitude, g.longitude], vmax_kmh=round(rg.vmax, 1), message=msg)
