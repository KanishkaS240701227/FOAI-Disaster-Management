"""Derive affected areas, depots and the default fleet from hazard scores (all rule based)."""
from __future__ import annotations

import math
from typing import Any, Dict, List, Tuple

from . import chennai_data as cd
from .chennai_seed import BASE_STOCK, FLEET_BY_SCALE, PER_PERSON, SCALE_MULT, TRUCK_TYPES

SEV_ORDER = [(0.78, "Critical"), (0.58, "High"), (0.40, "Medium"), (0.0, "Low")]


def _severity(x: float) -> str:
    for th, name in SEV_ORDER:
        if x >= th:
            return name
    return "Low"


def _demand(people: float, hazard: str) -> Dict[str, int]:
    mult = dict(food=1.0, water=1.0, medicine=1.0, blankets=1.0, emergency_kits=1.0)
    if hazard == "earthquake":
        mult.update(medicine=3.0, emergency_kits=2.0, blankets=1.4)
    elif hazard == "wind":
        mult.update(emergency_kits=1.5, blankets=1.2)
    else:   # flood
        mult.update(water=1.3, food=1.1)
    return {k: int(math.ceil(people * PER_PERSON[k] * mult[k])) for k in PER_PERSON}


def _fields(d: Dict[str, int]) -> Dict[str, int]:
    return {"food_demand": d["food"], "water_demand": d["water"], "medicine_demand": d["medicine"],
            "blanket_demand": d["blankets"], "emergency_kit_demand": d["emergency_kits"]}


def derive_affected_areas(zone_scores: Dict[str, Dict[str, Any]],
                          intensities: List[Tuple[Dict[str, Any], float]],
                          min_intensity: float = 0.30, cap: int = 60) -> List[Dict[str, Any]]:
    areas: List[Dict[str, Any]] = []
    for h, inten in intensities:
        if inten < min_intensity:
            continue
        phi = (min(1.0, (inten - 0.25) / 0.75) ** 1.15) * 0.18
        people = max(60, int(round(h["exposed_pop"] * phi, -1)))
        zs = zone_scores[h["zone"]]
        areas.append({
            "id": h["id"].replace("HS-", "AF-"), "name": h["name"], "latitude": h["lat"], "longitude": h["lng"],
            "population": h["exposed_pop"], "people_affected": people, "severity": _severity(inten),
            "zone_id": h["zone"], "hotspot_id": h["id"], "hazard": "flood", "risk_score": round(inten * 100, 1),
            "reason": f"Flood intensity {inten * 100:.0f}/100 (zone flood score {zs['flood']:.0f}, "
                      f"hotspot severity {h['severity']}/3, rain {zs['rain24']:.0f} mm/24 h)",
            **_fields(_demand(people, "flood")),
        })
    zmap = cd.zone_map()
    for zid, zs in zone_scores.items():
        z = zmap[zid]
        for hz, key, share in (("wind", "wind", 0.045), ("earthquake", "quake", 0.07)):
            score = zs[key] if hz == "wind" else (zs["quake"] if zs["quake"] > 12 else 0)
            if hz == "earthquake" and zs["quake"] <= 12:
                continue
            if score < 40:
                continue
            frac = min(1.0, (score - 30) / 70.0)
            people = int(round(z["pop"] * share * frac ** 1.3, -2))
            if people < 200:
                continue
            d = _demand(people, hz)
            areas.append({
                "id": f"AF-{zid}-{'WND' if hz == 'wind' else 'EQ'}",
                "name": f"{z['name']} - {'storm damage' if hz == 'wind' else 'quake damage'}",
                "latitude": z["centroid"][0], "longitude": z["centroid"][1],
                "population": z["pop"], "people_affected": people, "severity": _severity(score / 100.0),
                "zone_id": zid, "hotspot_id": None, "hazard": hz, "risk_score": round(score, 1),
                "reason": f"{hz.title()} score {score:.0f}/100 in {z['name']}",
                **_fields(d),
            })
    areas.sort(key=lambda a: a["risk_score"] * math.log10(a["people_affected"] + 10), reverse=True)
    return areas[:cap]


def default_warehouses(stock_mult: float = 1.0) -> List[Dict[str, Any]]:
    out = []
    for d in cd.depots():
        s = d["stocks"]
        out.append({
            "id": d["id"], "name": d["name"], "latitude": d["lat"], "longitude": d["lng"], "zone_id": d["zone"],
            "scale": d["scale"], "food_stock": int(s["food"] * stock_mult), "water_stock": int(s["water"] * stock_mult),
            "medicine_stock": int(s["medicine"] * stock_mult), "blanket_stock": int(s["blankets"] * stock_mult),
            "emergency_kit_stock": int(s["emergency_kits"] * stock_mult),
        })
    return out


def default_trucks() -> List[Dict[str, Any]]:
    out = []
    n = 0
    for d in cd.depots():
        for ttype in FLEET_BY_SCALE[d["scale"]]:
            n += 1
            label, cap, fuel_cap, speed, lpk = TRUCK_TYPES[ttype]
            out.append({"id": f"T{n:02d}", "truck_number": f"TN-RL-{n:03d}", "truck_type": label, "capacity": float(cap),
                        "fuel_capacity": float(fuel_cap), "average_speed": float(speed), "fuel_consumption": lpk,
                        "current_warehouse_id": d["id"], "status": "Available"})
    return out
