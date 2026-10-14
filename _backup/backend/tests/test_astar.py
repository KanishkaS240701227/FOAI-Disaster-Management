"""
Unit tests for Pure Classical A* Search Algorithm.
Verifies obstacle avoidance, Haversine heuristics, and optimal pathfinding.
Zero ML / DL.
"""

import math
from backend.algorithms.astar import astar_search, haversine_distance


def test_haversine_distance():
    # London (51.5074, -0.1278) to Paris (48.8566, 2.3522) is approx 343 km
    dist = haversine_distance(51.5074, -0.1278, 48.8566, 2.3522)
    assert 330.0 < dist < 360.0


def test_astar_simple_path():
    nodes = {
        "A": {"lat": 20.0, "lng": 80.0, "name": "Node A"},
        "B": {"lat": 20.1, "lng": 80.1, "name": "Node B"},
        "C": {"lat": 20.2, "lng": 80.2, "name": "Node C"},
    }
    edges = [
        {"source": "A", "destination": "B", "distance": 10.0, "status": "Open", "condition": "Paved"},
        {"source": "B", "destination": "C", "distance": 15.0, "status": "Open", "condition": "Paved"},
    ]

    res = astar_search(nodes, edges, "A", "C", trace_steps=True)
    assert res.found is True
    assert res.path == ["A", "B", "C"]
    assert res.total_distance_km == 25.0
    assert len(res.steps_log) > 0


def test_astar_avoids_blocked_roads():
    # Topology:
    # A --(Blocked: 5km)--> C
    # A --(Open: 10km)--> B --(Open: 10km)--> C
    nodes = {
        "A": {"lat": 20.0, "lng": 80.0, "name": "Node A"},
        "B": {"lat": 20.05, "lng": 80.05, "name": "Node B"},
        "C": {"lat": 20.1, "lng": 80.1, "name": "Node C"},
    }
    edges = [
        {"source": "A", "destination": "C", "distance": 5.0, "status": "Blocked", "condition": "Damaged"},
        {"source": "A", "destination": "B", "distance": 10.0, "status": "Open", "condition": "Paved"},
        {"source": "B", "destination": "C", "distance": 10.0, "status": "Open", "condition": "Paved"},
    ]

    res = astar_search(nodes, edges, "A", "C")
    assert res.found is True
    # Must detour through B because direct A->C is BLOCKED!
    assert res.path == ["A", "B", "C"]
    assert res.total_distance_km == 20.0


def test_astar_disconnected_target():
    nodes = {
        "A": {"lat": 20.0, "lng": 80.0, "name": "Node A"},
        "B": {"lat": 20.1, "lng": 80.1, "name": "Node B"},
    }
    edges = [
        {"source": "A", "destination": "B", "distance": 10.0, "status": "Blocked", "condition": "Damaged"},
    ]

    res = astar_search(nodes, edges, "A", "B")
    assert res.found is False
    assert len(res.path) == 0


if __name__ == "__main__":
    test_haversine_distance()
    test_astar_simple_path()
    test_astar_avoids_blocked_roads()
    test_astar_disconnected_target()
    print("All A* Search tests passed successfully!")
