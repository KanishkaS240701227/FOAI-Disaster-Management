"""
Graph Processing & Network Analysis using NetworkX.
Provides topology validation, connected component analysis, blocked road isolation,
and all-pairs A* shortest path computation for the Genetic Algorithm.
Zero Machine Learning / Deep Learning.
"""

from typing import Dict, List, Tuple, Any, Optional
import networkx as nx
from .astar import astar_search, haversine_distance


class ReliefGraph:
    """
    Manages the disaster relief road network graph.
    Integrates NetworkX for graph topology analysis and A* for path calculations.
    """

    def __init__(
        self,
        warehouses: List[Dict[str, Any]],
        affected_areas: List[Dict[str, Any]],
        roads: List[Dict[str, Any]],
    ):
        self.warehouses = {w["id"]: w for w in warehouses}
        self.affected_areas = {a["id"]: a for a in affected_areas}
        self.roads = roads

        # Node mapping: node_id -> {id, name, lat, lng, type, details}
        self.nodes: Dict[str, Dict[str, Any]] = {}
        for w in warehouses:
            self.nodes[w["id"]] = {
                "id": w["id"],
                "name": w.get("name", w["id"]),
                "lat": float(w["lat"]),
                "lng": float(w["lng"]),
                "type": "warehouse",
                "details": w,
            }

        for a in affected_areas:
            self.nodes[a["id"]] = {
                "id": a["id"],
                "name": a.get("name", a["id"]),
                "lat": float(a["lat"]),
                "lng": float(a["lng"]),
                "type": "affected_area",
                "severity": a.get("severity", "Medium"),
                "details": a,
            }

        # Build NetworkX graphs (Full graph and Open roads graph)
        self.full_graph = nx.Graph()
        self.open_graph = nx.Graph()

        for nid, ndata in self.nodes.items():
            self.full_graph.add_node(nid, **ndata)
            self.open_graph.add_node(nid, **ndata)

        for road in roads:
            src = str(road["source_id"])
            dst = str(road["destination_id"])
            dist = float(road.get("distance", 0.0))
            status = str(road.get("status", "Open")).strip().capitalize()
            cond = str(road.get("condition", "Paved")).strip().capitalize()
            time_est = float(road.get("travel_time", dist / 50.0))

            if src in self.nodes and dst in self.nodes:
                self.full_graph.add_edge(
                    src, dst,
                    distance=dist,
                    travel_time=time_est,
                    status=status,
                    condition=cond,
                    road_id=road.get("id"),
                )
                # Add to open graph only if not blocked
                if status != "Blocked":
                    self.open_graph.add_edge(
                        src, dst,
                        distance=dist,
                        travel_time=time_est,
                        status=status,
                        condition=cond,
                        road_id=road.get("id"),
                    )

    def validate_network(self) -> Dict[str, Any]:
        """
        Validates graph connectivity and identifies unreachable nodes or isolated components.
        """
        all_node_ids = set(self.nodes.keys())
        isolated_nodes = list(nx.isolates(self.open_graph))

        # Check connected components on open graph
        components = [list(c) for c in nx.connected_components(self.open_graph)]

        # Check if every affected area has an open path to at least one warehouse
        wh_ids = set(self.warehouses.keys())
        unreachable_areas = []

        for aid in self.affected_areas:
            can_reach_wh = False
            for wid in wh_ids:
                if nx.has_path(self.open_graph, aid, wid):
                    can_reach_wh = True
                    break
            if not can_reach_wh:
                unreachable_areas.append({
                    "id": aid,
                    "name": self.nodes[aid]["name"],
                    "severity": self.nodes[aid].get("severity", "Medium"),
                })

        # Count blocked roads
        blocked_roads = [
            r for r in self.roads if str(r.get("status", "")).strip().capitalize() == "Blocked"
        ]

        return {
            "total_nodes": len(self.nodes),
            "total_roads": len(self.roads),
            "open_roads_count": len(self.roads) - len(blocked_roads),
            "blocked_roads_count": len(blocked_roads),
            "connected_components_count": len(components),
            "is_fully_connected": len(components) <= 1 and len(self.nodes) > 0,
            "isolated_nodes": isolated_nodes,
            "unreachable_affected_areas": unreachable_areas,
            "has_critical_unreachable": any(a["severity"] == "Critical" for a in unreachable_areas),
        }

    def compute_all_pairs_astar(
        self,
        truck_speed_kmh: float = 60.0,
        truck_fuel_rate_lpkm: float = 0.25,
    ) -> Dict[Tuple[str, str], Dict[str, Any]]:
        """
        Precomputes all-pairs shortest paths using pure Classical A* Search,
        strictly avoiding blocked roads.
        Used as the distance/cost look-up matrix by the Genetic Algorithm.
        """
        matrix: Dict[Tuple[str, str], Dict[str, Any]] = {}
        all_ids = list(self.nodes.keys())

        # Format roads as edge dicts for A*
        edge_list = []
        for r in self.roads:
            edge_list.append({
                "source": str(r["source_id"]),
                "destination": str(r["destination_id"]),
                "distance": float(r.get("distance", 0.0)),
                "status": str(r.get("status", "Open")).strip().capitalize(),
                "condition": str(r.get("condition", "Paved")).strip().capitalize(),
                "one_way": r.get("one_way", False),
            })

        for i, src in enumerate(all_ids):
            for j, dst in enumerate(all_ids):
                if src == dst:
                    matrix[(src, dst)] = {
                        "found": True,
                        "distance": 0.0,
                        "time": 0.0,
                        "fuel": 0.0,
                        "path": [src],
                        "coordinates": [(self.nodes[src]["lat"], self.nodes[src]["lng"])],
                    }
                    continue

                if (dst, src) in matrix:
                    # Symmetric path reuse if bidirectional
                    rev = matrix[(dst, src)]
                    matrix[(src, dst)] = {
                        "found": rev["found"],
                        "distance": rev["distance"],
                        "time": rev["time"],
                        "fuel": rev["fuel"],
                        "path": list(reversed(rev["path"])),
                        "coordinates": list(reversed(rev["coordinates"])),
                    }
                    continue

                res = astar_search(
                    graph_nodes=self.nodes,
                    graph_edges=edge_list,
                    start_id=src,
                    goal_id=dst,
                    truck_speed_kmh=truck_speed_kmh,
                    truck_fuel_rate_lpkm=truck_fuel_rate_lpkm,
                    trace_steps=False,
                )

                matrix[(src, dst)] = {
                    "found": res.found,
                    "distance": res.total_distance_km if res.found else 9999.0,
                    "time": res.estimated_travel_time_hours if res.found else 999.0,
                    "fuel": res.estimated_fuel_liters if res.found else 999.0,
                    "path": res.path if res.found else [],
                    "coordinates": res.path_coordinates if res.found else [],
                }

        return matrix
