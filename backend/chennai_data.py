"""Loader for the static Chennai datasets in backend/data/chennai (built by scripts/build_chennai_data.py)."""
from __future__ import annotations

import json
import os
from functools import lru_cache
from typing import Any, Dict, List

from .roadnet import DATA_DIR


def _load(name: str):
    with open(os.path.join(DATA_DIR, name), "r", encoding="utf-8") as fh:
        return json.load(fh)


@lru_cache(maxsize=1)
def meta() -> Dict[str, Any]:
    return _load("meta.json")


@lru_cache(maxsize=1)
def zones_geojson() -> Dict[str, Any]:
    return _load("zones.geojson")


@lru_cache(maxsize=1)
def outline_geojson() -> Dict[str, Any]:
    return _load("outline.geojson")


@lru_cache(maxsize=1)
def zones() -> List[Dict[str, Any]]:
    return [dict(f["properties"]) for f in zones_geojson()["features"]]


@lru_cache(maxsize=1)
def zone_map() -> Dict[str, Dict[str, Any]]:
    return {z["id"]: z for z in zones()}


@lru_cache(maxsize=1)
def hotspots() -> List[Dict[str, Any]]:
    return _load("hotspots.json")


@lru_cache(maxsize=1)
def hotspot_map() -> Dict[str, Dict[str, Any]]:
    return {h["id"]: h for h in hotspots()}


@lru_cache(maxsize=1)
def depots() -> List[Dict[str, Any]]:
    return _load("depots.json")
