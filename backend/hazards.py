"""
Hazard engine: live weather / earthquake feeds + transparent rule-based risk scoring per zone.

Everything here is classical, explainable arithmetic (piece-wise thresholds from IMD / MMI scales
combined with zone attributes).  No machine learning.

Live sources (all free, no API key):
  * Open-Meteo forecast API  - hourly rain + wind gusts for 7 points across Chennai
  * Open-Meteo marine API    - open-sea wave height (storm-surge indicator)
  * Open-Meteo flood API     - river discharge forecast (indicator only, coarse grid)
  * USGS earthquake catalogue - events within 600 km, last 3 days
"""
from __future__ import annotations

import json
import math
import os
import threading
import time
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

from . import chennai_data as cd
from .roadnet import haversine_km

IST = timezone(timedelta(hours=5, minutes=30))
CACHE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "cache")
CACHE_FILE = os.path.join(CACHE_DIR, "hazards_live.json")
USER_AGENT = "ChennaiReliefPlanner/2.0 (academic disaster-logistics project)"

# Weather sample points: id -> (lat, lng)
SAMPLE_POINTS = {
    "N": (13.15, 80.27), "C": (13.07, 80.24), "W": (13.08, 80.14), "S": (12.95, 80.21),
    "SW": (12.92, 80.11), "NW": (13.115, 80.11), "SE": (12.90, 80.25),
}

LEVELS = [(75, "Severe"), (50, "High"), (25, "Elevated"), (0, "Low")]
BASELINE_QUAKE = 6   # Chennai sits in seismic zone III (moderate) - constant background


def level_for(score: float) -> str:
    for th, name in LEVELS:
        if score >= th:
            return name
    return "Low"


def _pw(x: float, pts: List[Tuple[float, float]]) -> float:
    """Piece-wise linear interpolation through (x, y) points, clamped at both ends."""
    if x <= pts[0][0]:
        return pts[0][1]
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        if x <= x1:
            return y0 + (y1 - y0) * (x - x0) / (x1 - x0)
    return pts[-1][1]


# IMD rainfall classes (24 h): heavy 64.5, very heavy 115.6, extremely heavy 204.5 mm
def rain_factor(rain24: float, rain72: float) -> float:
    f24 = _pw(rain24, [(10, 0.0), (30, 0.08), (64.5, 0.35), (115.6, 0.60), (204.5, 0.85), (300, 1.0)])
    f72 = _pw(rain72, [(30, 0.0), (80, 0.10), (150, 0.35), (250, 0.60), (400, 0.85), (550, 1.0)])
    return max(f24, f72)


def wind_factor(gust_kmh: float) -> float:       # IMD: storm 62, severe 89, very severe 118, extremely severe 168
    return _pw(gust_kmh, [(35, 0.0), (62, 0.30), (89, 0.55), (118, 0.80), (168, 1.0)])


def quake_mmi(mag: float, dist_km: float, depth_km: float) -> float:
    r = math.sqrt(dist_km ** 2 + max(depth_km, 5.0) ** 2)
    return 1.5 * mag - 3.3 * math.log10(max(r, 5.0)) + 1.0


def clamp(x: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, x))


class HazardState:
    """Container for hazard inputs (live or scenario)."""

    def __init__(self, mode: str = "live", label: str = "Live conditions"):
        self.mode = mode                      # live | scenario | offline
        self.label = label
        self.rain24 = 0.0
        self.rain72 = 0.0
        self.gust = 0.0
        self.surge_m = 0.0
        self.river_index: Optional[float] = None
        self.quakes: List[Dict[str, Any]] = []
        self.zone_rain: Dict[str, Tuple[float, float]] = {}    # zone -> (rain24, rain72)
        self.zone_gust: Dict[str, float] = {}
        self.fetched_at: Optional[str] = None
        self.stale = False
        self.sources: Dict[str, Dict[str, Any]] = {}
        self.description = ""
        self.timeline: List[Dict[str, Any]] = []     # next-48h outlook (live): [{t, rain, gust}]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "mode": self.mode, "label": self.label, "description": self.description,
            "rain24": round(self.rain24, 1), "rain72": round(self.rain72, 1),
            "gust_kmh": round(self.gust, 1), "surge_m": round(self.surge_m, 2),
            "river_index": None if self.river_index is None else round(self.river_index, 2),
            "quakes": self.quakes, "fetched_at": self.fetched_at, "stale": self.stale,
            "sources": self.sources, "timeline": self.timeline,
        }


# ---------------------------------------------------------------------------------------------
# Scoring
# ---------------------------------------------------------------------------------------------
def score_zones(state: HazardState) -> Dict[str, Dict[str, Any]]:
    """Compute per-zone risk scores (0-100) with human-readable drivers."""
    hs_by_zone: Dict[str, List[Dict[str, Any]]] = {}
    for h in cd.hotspots():
        hs_by_zone.setdefault(h["zone"], []).append(h)

    out: Dict[str, Dict[str, Any]] = {}
    for z in cd.zones():
        zid = z["id"]
        hs = hs_by_zone.get(zid, [])
        sev_sum = sum(h["severity"] for h in hs)
        H = min(1.0, sev_sum / 9.0)
        L = z["low_lying"]
        susceptibility = 0.40 + 0.35 * L + 0.25 * H
        r24, r72 = state.zone_rain.get(zid, (state.rain24, state.rain72))
        gust = state.zone_gust.get(zid, state.gust)
        rf = rain_factor(r24, r72)
        river = state.river_index or 0.0
        flood = clamp(100 * rf * susceptibility * (1 + 0.12 * river * L))

        coastal = 1.0 if z["coastal"] else 0.0
        wind = clamp(100 * wind_factor(gust) * (0.60 + 0.40 * coastal))
        surge = clamp(100 * min(1.0, state.surge_m / 2.5) * coastal * (0.7 + 0.3 * L))
        wind = max(wind, 0.9 * surge)

        q_best, q_mmi, q_src = 0.0, 0.0, None
        zc = z["centroid"]
        for q in state.quakes:
            d = haversine_km(zc[0], zc[1], q["lat"], q["lng"])
            mmi = quake_mmi(q["mag"], d, q.get("depth_km", 10.0)) * (0.92 + 0.08 * z["soil"] * 1.0)
            mmi += 0.35 * (z["soil"] - 1.0) * 5   # soft alluvial / coastal soil amplifies shaking
            s = clamp(100 * (mmi - 3.0) / 5.0)
            if s > q_best:
                q_best, q_mmi, q_src = s, mmi, q
        quake = max(q_best, BASELINE_QUAKE)

        parts = sorted([flood, wind, q_best], reverse=True)
        overall = clamp(parts[0] + 0.30 * parts[1])
        drivers = []
        if flood >= 20:
            drivers.append(f"Flood {flood:.0f}: rain {r24:.0f} mm/24 h, {r72:.0f} mm/72 h; "
                           f"low-lying {L:.2f}; {len(hs)} flood hotspots")
        if wind >= 20:
            drivers.append(f"Wind {wind:.0f}: gusts {gust:.0f} km/h" + (", coastal exposure" if z["coastal"] else ""))
        if q_best >= 15 and q_src:
            drivers.append(f"Quake {q_best:.0f}: M{q_src['mag']:.1f} ~{q_src.get('dist_km', 0):.0f} km, est. MMI {q_mmi:.1f}")
        out[zid] = {
            "zone_id": zid, "overall": round(overall, 1), "level": level_for(overall),
            "flood": round(flood, 1), "wind": round(wind, 1), "quake": round(quake, 1),
            "rain24": round(r24, 1), "rain72": round(r72, 1), "gust": round(gust, 1),
            "hotspots": len(hs), "severe_hotspots": sum(1 for h in hs if h["severity"] >= 3),
            "drivers": drivers,
        }
    return out


def hotspot_intensities(zone_scores: Dict[str, Dict[str, Any]]) -> List[Tuple[Dict[str, Any], float]]:
    out = []
    for h in cd.hotspots():
        zs = zone_scores.get(h["zone"])
        if not zs:
            continue
        inten = min(1.0, zs["flood"] / 100.0 * (0.55 + 0.45 * h["severity"] / 3.0))
        out.append((h, round(inten, 3)))
    return out


def city_summary(zone_scores: Dict[str, Dict[str, Any]]) -> Dict[str, Any]:
    zs = list(zone_scores.values())
    zmap = cd.zone_map()
    pop_total = sum(zmap[z["zone_id"]]["pop"] for z in zs) or 1
    weighted = sum(z["overall"] * zmap[z["zone_id"]]["pop"] for z in zs) / pop_total
    worst = max(zs, key=lambda z: z["overall"])
    peak = max(z["overall"] for z in zs)
    meter = clamp(0.55 * peak + 0.45 * weighted)
    return {
        "meter": round(meter, 1), "level": level_for(meter), "peak_zone": worst["zone_id"],
        "peak_score": worst["overall"], "population_weighted": round(weighted, 1),
        "zones_high": sum(1 for z in zs if z["overall"] >= 50),
        "zones_elevated": sum(1 for z in zs if 25 <= z["overall"] < 50),
        "pop_at_risk": sum(zmap[z["zone_id"]]["pop"] for z in zs if z["overall"] >= 50),
    }


# ---------------------------------------------------------------------------------------------
# Live feeds
# ---------------------------------------------------------------------------------------------
def _get_json(url: str, timeout: int = 20) -> Any:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


def _peak_window(series: List[float], lo: int, hi: int, width: int = 24) -> float:
    lo, hi = max(0, lo), min(len(series), hi)
    best = 0.0
    for i in range(lo, max(lo + 1, hi - width + 1)):
        best = max(best, sum(v or 0.0 for v in series[i:i + width]))
    return best


def fetch_live() -> HazardState:
    st = HazardState("live", "Live conditions")
    now = datetime.now(IST)
    ids = list(SAMPLE_POINTS)
    lat = ",".join(str(SAMPLE_POINTS[i][0]) for i in ids)
    lng = ",".join(str(SAMPLE_POINTS[i][1]) for i in ids)
    srcs: Dict[str, Dict[str, Any]] = {}

    # 1) rain + wind -----------------------------------------------------------------------
    try:
        url = ("https://api.open-meteo.com/v1/forecast?latitude=%s&longitude=%s&hourly=precipitation,wind_gusts_10m"
               "&past_days=1&forecast_days=3&timezone=Asia%%2FKolkata" % (lat, lng))
        data = _get_json(url)
        data = data if isinstance(data, list) else [data]
        per_point: Dict[str, Dict[str, Any]] = {}
        for pid, d in zip(ids, data):
            h = d["hourly"]
            times = h["time"]
            idx_now = max(0, min(len(times) - 1, int((now.replace(tzinfo=None, minute=0, second=0, microsecond=0)
                                                       - datetime.fromisoformat(times[0])).total_seconds() // 3600)))
            pr = [v or 0.0 for v in h["precipitation"]]
            gu = [v or 0.0 for v in h["wind_gusts_10m"]]
            r24 = _peak_window(pr, idx_now - 24, idx_now + 48, 24)
            r72 = _peak_window(pr, idx_now - 24, idx_now + 48, 72)
            per_point[pid] = {"r24": r24, "r72": r72, "gust": max(gu[max(0, idx_now - 6): idx_now + 49] or [0.0]),
                              "pr": pr, "gu": gu, "i0": idx_now, "times": times}
        for z in cd.zones():
            zc = z["centroid"]
            pid = min(ids, key=lambda p: haversine_km(zc[0], zc[1], *SAMPLE_POINTS[p]))
            pp = per_point[pid]
            st.zone_rain[z["id"]] = (pp["r24"], pp["r72"])
            st.zone_gust[z["id"]] = pp["gust"]
        st.rain24 = max(p["r24"] for p in per_point.values())
        st.rain72 = max(p["r72"] for p in per_point.values())
        st.gust = max(p["gust"] for p in per_point.values())
        c = per_point["C"]
        i0 = c["i0"]
        st.timeline = [{"t": c["times"][i], "rain": round(c["pr"][i], 1), "gust": round(c["gu"][i], 0)}
                       for i in range(max(0, i0 - 6), min(len(c["times"]), i0 + 49))]
        srcs["weather"] = {"ok": True, "name": "Open-Meteo forecast"}
    except Exception as exc:
        srcs["weather"] = {"ok": False, "name": "Open-Meteo forecast", "error": str(exc)[:160]}

    # 2) marine (surge proxy) --------------------------------------------------------------
    try:
        d = _get_json("https://marine-api.open-meteo.com/v1/marine?latitude=13.10&longitude=80.45"
                      "&hourly=wave_height&forecast_days=3&timezone=Asia%2FKolkata")
        waves = [v for v in d["hourly"]["wave_height"] if v is not None]
        st.surge_m = max(0.0, (max(waves) - 2.0) * 0.45) if waves else 0.0
        srcs["marine"] = {"ok": True, "name": "Open-Meteo marine", "max_wave_m": round(max(waves), 1) if waves else None}
    except Exception as exc:
        srcs["marine"] = {"ok": False, "name": "Open-Meteo marine", "error": str(exc)[:160]}

    # 3) river discharge -------------------------------------------------------------------
    try:
        d = _get_json("https://flood-api.open-meteo.com/v1/flood?latitude=13.05&longitude=80.22"
                      "&daily=river_discharge&past_days=5&forecast_days=7")
        vals = [v for v in d["daily"]["river_discharge"] if v is not None]
        if len(vals) >= 6:
            base = sorted(vals[:5])[2] + 0.5
            st.river_index = clamp((max(vals[5:]) / base - 1.0) / 6.0, 0.0, 1.0)
        srcs["river"] = {"ok": True, "name": "Open-Meteo flood (indicator)"}
    except Exception as exc:
        srcs["river"] = {"ok": False, "name": "Open-Meteo flood", "error": str(exc)[:160]}

    # 4) earthquakes -----------------------------------------------------------------------
    try:
        start = (datetime.now(timezone.utc) - timedelta(days=3)).strftime("%Y-%m-%dT%H:%M:%S")
        q = urllib.parse.urlencode({"format": "geojson", "starttime": start, "latitude": 13.08, "longitude": 80.27,
                                    "maxradiuskm": 600, "minmagnitude": 3.5, "orderby": "time", "limit": 20})
        d = _get_json("https://earthquake.usgs.gov/fdsnws/event/1/query?" + q)
        for f in d.get("features", []):
            lo, la, dep = f["geometry"]["coordinates"][:3]
            st.quakes.append({"mag": f["properties"]["mag"], "place": f["properties"]["place"], "lat": la, "lng": lo,
                              "depth_km": dep, "time": f["properties"]["time"],
                              "dist_km": round(haversine_km(13.08, 80.27, la, lo))})
        srcs["quake"] = {"ok": True, "name": "USGS earthquakes", "count": len(st.quakes)}
    except Exception as exc:
        srcs["quake"] = {"ok": False, "name": "USGS earthquakes", "error": str(exc)[:160]}

    st.sources = srcs
    st.fetched_at = datetime.now(IST).isoformat(timespec="seconds")
    st.description = "Current forecast and seismic feeds for Chennai"
    return st


def _state_to_cache(st: HazardState) -> Dict[str, Any]:
    d = st.to_dict()
    d["zone_rain"] = st.zone_rain
    d["zone_gust"] = st.zone_gust
    return d


def _state_from_cache(d: Dict[str, Any]) -> HazardState:
    st = HazardState("live", "Live conditions (cached)")
    st.rain24, st.rain72, st.gust = d["rain24"], d["rain72"], d["gust_kmh"]
    st.surge_m, st.river_index, st.quakes = d["surge_m"], d["river_index"], d["quakes"]
    st.zone_rain = {k: tuple(v) for k, v in d.get("zone_rain", {}).items()}
    st.zone_gust = d.get("zone_gust", {})
    st.fetched_at, st.sources, st.timeline = d["fetched_at"], d.get("sources", {}), d.get("timeline", [])
    return st


class HazardEngine:
    """Holds the active hazard state (live or scenario) and refreshes live feeds in the background."""

    REFRESH_SECONDS = 900

    def __init__(self):
        self._lock = threading.RLock()
        self.live = HazardState("offline", "Waiting for live data")
        self.live.description = "Live feeds not loaded yet"
        self.scenario: Optional[HazardState] = None
        self.scenario_key: Optional[str] = None
        self._cache_scores: Optional[Tuple[int, Dict[str, Dict[str, Any]]]] = None
        self._load_cache()
        self.last_attempt: Optional[float] = None

    # ---- cache -------------------------------------------------------------------------
    def _load_cache(self):
        try:
            with open(CACHE_FILE, "r", encoding="utf-8") as fh:
                st = _state_from_cache(json.load(fh))
            st.stale = True
            self.live = st
        except Exception:
            pass

    def _save_cache(self, st: HazardState):
        try:
            os.makedirs(CACHE_DIR, exist_ok=True)
            with open(CACHE_FILE, "w", encoding="utf-8") as fh:
                json.dump(_state_to_cache(st), fh)
        except Exception:
            pass

    # ---- refresh -----------------------------------------------------------------------
    def refresh_live(self) -> HazardState:
        self.last_attempt = time.time()
        new = fetch_live()
        ok = new.sources.get("weather", {}).get("ok", False)
        with self._lock:
            if ok:
                self.live = new
                self._save_cache(new)
            else:
                # keep previous data but mark as stale + record the errors
                self.live.stale = True
                self.live.sources = new.sources or self.live.sources
                if self.live.mode == "offline":
                    self.live.label = "Live feed unavailable"
                    self.live.description = "Could not reach weather services - showing baseline conditions"
            self._cache_scores = None
            return self.live

    # ---- scenarios -----------------------------------------------------------------------
    def set_scenario(self, key: Optional[str], state: Optional[HazardState] = None):
        with self._lock:
            self.scenario_key, self.scenario = key, state
            self._cache_scores = None

    def active(self) -> HazardState:
        with self._lock:
            return self.scenario if self.scenario is not None else self.live

    def scores(self) -> Dict[str, Dict[str, Any]]:
        with self._lock:
            st = self.active()
            key = id(st) ^ int(len(st.quakes) * 7919) ^ int(st.rain24 * 10)
            if self._cache_scores and self._cache_scores[0] == key:
                return self._cache_scores[1]
            sc = score_zones(st)
            self._cache_scores = (key, sc)
            return sc

    def snapshot(self) -> Dict[str, Any]:
        st = self.active()
        sc = self.scores()
        return {
            "state": st.to_dict(), "zones": sc, "summary": city_summary(sc),
            "scenario_key": self.scenario_key,
            "generated_at": datetime.now(IST).isoformat(timespec="seconds"),
        }


ENGINE = HazardEngine()
