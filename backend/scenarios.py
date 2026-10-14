"""
Chennai disaster scenarios.

A scenario only defines the HAZARD inputs (rain, wind, surge, earthquake ...).  Affected areas,
road closures and relief demand are then derived from them by the same rule-based engine that
scores live conditions - so a replay behaves exactly like a real event would.

Numbers are approximate / representative of each event, not official measurements.
"""
from __future__ import annotations

from typing import Any, Dict, Optional

from .hazards import HazardState

SCENARIOS: Dict[str, Dict[str, Any]] = {
    "live": {
        "name": "Live conditions",
        "short": "Live",
        "kind": "live",
        "description": "Real-time forecast and earthquake feeds for Chennai (refreshed every 15 minutes).",
        "stock_mult": 1.0,
    },
    "michaung_2023": {
        "name": "Cyclone Michaung (Dec 2023)",
        "short": "Michaung 2023",
        "kind": "flood",
        "description": "Extremely heavy rain over 24 h with strong gusts; south and east Chennai (Velachery, Pallikaranai, "
                       "Perungudi) worst hit and Pallavaram / Tambaram flooded from the Adyar.",
        "rain24": 290, "rain72": 440, "gust": 95, "surge_m": 0.8, "river": 0.7,
        "spatial": {"Z13": 1.10, "Z14": 1.20, "Z15": 1.20, "Z12": 1.08, "S-TAMBARAM": 1.10, "S-CHROMPET": 1.08,
                    "Z01": 0.92, "Z02": 0.95, "Z03": 0.95},
        "stock_mult": 1.0,
    },
    "floods_2015": {
        "name": "Chennai floods (Dec 2015)",
        "short": "Floods 2015",
        "kind": "flood",
        "description": "Record rainfall over two days and a large release from Chembarambakkam: the Adyar and Cooum "
                       "overflow and most of the city is inundated.",
        "rain24": 345, "rain72": 520, "gust": 45, "surge_m": 0.0, "river": 1.0,
        "spatial": {"Z12": 1.10, "Z13": 1.12, "Z10": 1.05, "Z11": 1.08, "S-TAMBARAM": 1.12, "S-PALLAVARAM": 1.08},
        "stock_mult": 1.0,
    },
    "fengal_2024": {
        "name": "Cyclone Fengal (Nov 2024)",
        "short": "Fengal 2024",
        "kind": "cyclone",
        "description": "Cyclonic storm making landfall near Puducherry: heavy rain and strong gusts across the city.",
        "rain24": 140, "rain72": 230, "gust": 80, "surge_m": 0.6, "river": 0.35,
        "spatial": {"Z15": 1.12, "Z14": 1.10, "Z13": 1.05},
        "stock_mult": 1.0,
    },
    "vardah_2016": {
        "name": "Cyclone Vardah (Dec 2016)",
        "short": "Vardah 2016",
        "kind": "cyclone",
        "description": "Very severe cyclonic storm with 100+ km/h gusts: uprooted trees and power lines blocking arterial "
                       "roads, with moderate rain.",
        "rain24": 90, "rain72": 125, "gust": 140, "surge_m": 1.4, "river": 0.2,
        "spatial": {"Z01": 1.05, "Z04": 1.05, "Z05": 1.05, "Z09": 1.05},
        "stock_mult": 1.0,
    },
    "cyclone_drill": {
        "name": "Severe cyclone landfall (drill)",
        "short": "Cyclone drill",
        "kind": "cyclone",
        "description": "Hypothetical very severe cyclone crossing the coast near north Chennai with surge and heavy rain.",
        "rain24": 190, "rain72": 280, "gust": 150, "surge_m": 2.2, "river": 0.5,
        "spatial": {"Z01": 1.10, "Z02": 1.05, "Z04": 1.10, "Z05": 1.10},
        "stock_mult": 1.0,
    },
    "quake_drill": {
        "name": "M6.6 offshore earthquake (drill)",
        "short": "Quake drill",
        "kind": "earthquake",
        "description": "Hypothetical magnitude 6.6 earthquake about 25 km off the coast, depth 15 km. Chennai lies in "
                       "seismic zone III; soft coastal soils amplify shaking.",
        "rain24": 0, "rain72": 0, "gust": 0, "surge_m": 0.0, "river": 0.0,
        "quakes": [{"mag": 6.6, "lat": 13.00, "lng": 80.52, "depth_km": 15.0,
                    "place": "Hypothetical epicentre, Bay of Bengal", "time": None}],
        "stock_mult": 1.0,
    },
}


def scenario_list():
    return [{"key": k, "name": v["name"], "short": v["short"], "kind": v["kind"], "description": v["description"]}
            for k, v in SCENARIOS.items()]


def build_hazard_state(key: str) -> Optional[HazardState]:
    """HazardState for a scenario (None for 'live')."""
    from . import chennai_data as cd
    sc = SCENARIOS[key]
    if sc["kind"] == "live":
        return None
    st = HazardState("scenario", sc["name"])
    st.description = sc["description"]
    st.rain24, st.rain72, st.gust = sc["rain24"], sc["rain72"], sc["gust"]
    st.surge_m, st.river_index = sc["surge_m"], sc.get("river", 0.0)
    for q in sc.get("quakes", []):
        from .roadnet import haversine_km
        st.quakes.append({**q, "dist_km": round(haversine_km(13.08, 80.27, q["lat"], q["lng"]))})
    for zid, m in sc.get("spatial", {}).items():
        st.zone_rain[zid] = (st.rain24 * m, st.rain72 * m)
        st.zone_gust[zid] = st.gust * (0.97 + 0.03 * m)
    st.sources = {"scenario": {"ok": True, "name": "Scenario replay"}}
    return st
