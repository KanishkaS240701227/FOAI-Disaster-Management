"""Process-wide singletons: the road network and helpers that keep it in sync with hazards."""
from __future__ import annotations

import threading
from typing import Dict, Any

from .roadnet import RoadNetwork
from .hazards import ENGINE, hotspot_intensities

_lock = threading.RLock()
ROAD: RoadNetwork = RoadNetwork.load()


def reload_road() -> RoadNetwork:
    """Re-read the road network from disk (after the OSM download finished) and re-apply state."""
    global ROAD
    with _lock:
        ROAD = RoadNetwork.load()
        apply_hazards()
        return ROAD


def network_signature() -> str:
    return f"{ROAD.source}:{len(ROAD.nodes)}:{len(ROAD.edges)}"


def apply_hazards() -> Dict[str, Any]:
    """Slow / block roads around flooded hotspots according to the active hazard scores."""
    with _lock:
        sc = ENGINE.scores()
        ROAD.apply_hazards(hotspot_intensities(sc))
        return ROAD.state_counts()
