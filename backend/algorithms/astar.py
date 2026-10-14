"""
Pure Classical A* Search Algorithm for Disaster Relief Routing.
Uses graph heuristics (Haversine/Euclidean distance) to find the shortest valid route
from warehouses to affected locations, strictly avoiding blocked roads.
Provides detailed step-by-step execution telemetry for interactive algorithm visualization.
NO Machine Learning or Deep Learning used.
"""

import math
import heapq
from typing import Dict, List, Tuple, Optional, Any, Set
from dataclasses import dataclass, field


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the great-circle distance between two points on Earth (in kilometers).
    Admissible and consistent heuristic for geographical 2D navigation.
    """
    R = 6371.0  # Earth's mean radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


@dataclass(order=True)
class PrioritizedNode:
    f_score: float
    g_score: float = field(compare=False)
    node_id: str = field(compare=False)
    parent_id: Optional[str] = field(default=None, compare=False)


@dataclass
class AStarStep:
    step_num: int
    current_node: str
    current_f: float
    current_g: float
    current_h: float
    open_list: List[Dict[str, Any]]
    closed_list: List[str]
    neighbors_evaluated: List[Dict[str, Any]]
    action_description: str


@dataclass
class AStarResult:
    found: bool
    path: List[str]
    path_coordinates: List[Tuple[float, float]]
    total_distance_km: float
    estimated_travel_time_hours: float
    estimated_fuel_liters: float
    nodes_explored_count: int
    open_list_final_size: int
    steps_log: List[Dict[str, Any]]
    message: str


class AStarVisualizerTracer:
    """
    Traces every step of the A* search for interactive visualization in the frontend.
    """
    def __init__(self):
        self.steps: List[AStarStep] = []
        self.step_counter = 0

    def record_step(
        self,
        current_node: str,
        current_f: float,
        current_g: float,
        current_h: float,
        open_set: List[PrioritizedNode],
        closed_set: Set[str],
        neighbors_evaluated: List[Dict[str, Any]],
        description: str,
    ):
        self.step_counter += 1
        open_list_snapshot = [
            {
                "node_id": item.node_id,
                "f_score": round(item.f_score, 3),
                "g_score": round(item.g_score, 3),
                "parent_id": item.parent_id,
            }
            for item in sorted(open_set, key=lambda x: x.f_score)
        ]
        self.steps.append(
            AStarStep(
                step_num=self.step_counter,
                current_node=current_node,
                current_f=round(current_f, 3),
                current_g=round(current_g, 3),
                current_h=round(current_h, 3),
                open_list=open_list_snapshot,
                closed_list=sorted(list(closed_set)),
                neighbors_evaluated=neighbors_evaluated,
                action_description=description,
            )
        )

    def to_dict_list(self) -> List[Dict[str, Any]]:
        return [
            {
                "step_num": s.step_num,
                "current_node": s.current_node,
                "current_f": s.current_f,
                "current_g": s.current_g,
                "current_h": s.current_h,
                "open_list": s.open_list,
                "closed_list": s.closed_list,
                "neighbors_evaluated": s.neighbors_evaluated,
                "action_description": s.action_description,
            }
            for s in self.steps
        ]


def astar_search(
    graph_nodes: Dict[str, Dict[str, Any]],
    graph_edges: List[Dict[str, Any]],
    start_id: str,
    goal_id: str,
    truck_speed_kmh: float = 60.0,
    truck_fuel_rate_lpkm: float = 0.25,
    trace_steps: bool = False,
) -> AStarResult:
    """
    Executes Classical A* Search from start_id to goal_id.
    
    Parameters:
    - graph_nodes: Dict mapping node_id -> {"lat": float, "lng": float, "name": str, "type": str}
    - graph_edges: List of dicts with {"source": str, "destination": str, "distance": float, "status": str, "condition": str}
    - start_id: Starting warehouse or node ID
    - goal_id: Target affected area or node ID
    - truck_speed_kmh: Average truck speed in km/h
    - truck_fuel_rate_lpkm: Fuel consumption in Liters per km
    - trace_steps: If True, captures full step-by-step trace for UI visualizer
    
    Rules:
    - Blocked roads must NEVER be traversed.
    - Under repair roads have 1.5x traversal cost.
    - Uses Haversine heuristic h(n) which is admissible and consistent.
    """
    tracer = AStarVisualizerTracer() if trace_steps else None

    # Validation
    if start_id not in graph_nodes:
        return AStarResult(
            found=False,
            path=[],
            path_coordinates=[],
            total_distance_km=0.0,
            estimated_travel_time_hours=0.0,
            estimated_fuel_liters=0.0,
            nodes_explored_count=0,
            open_list_final_size=0,
            steps_log=[],
            message=f"Start location '{start_id}' not found in road network.",
        )

    if goal_id not in graph_nodes:
        return AStarResult(
            found=False,
            path=[],
            path_coordinates=[],
            total_distance_km=0.0,
            estimated_travel_time_hours=0.0,
            estimated_fuel_liters=0.0,
            nodes_explored_count=0,
            open_list_final_size=0,
            steps_log=[],
            message=f"Goal location '{goal_id}' not found in road network.",
        )

    if start_id == goal_id:
        coords = [(graph_nodes[start_id]["lat"], graph_nodes[start_id]["lng"])]
        return AStarResult(
            found=True,
            path=[start_id],
            path_coordinates=coords,
            total_distance_km=0.0,
            estimated_travel_time_hours=0.0,
            estimated_fuel_liters=0.0,
            nodes_explored_count=1,
            open_list_final_size=0,
            steps_log=[],
            message="Start and goal are identical (0 km distance).",
        )

    # Build adjacency list, filtering blocked roads
    adjacency: Dict[str, List[Dict[str, Any]]] = {n: [] for n in graph_nodes}
    for edge in graph_edges:
        status = str(edge.get("status", "Open")).strip().capitalize()
        # Strictly avoid blocked roads
        if status == "Blocked":
            continue

        src = str(edge["source"])
        dst = str(edge["destination"])
        dist = float(edge.get("distance", 0.0))
        cond = str(edge.get("condition", "Paved")).strip().capitalize()

        # Adjust cost based on road condition (Paved = 1.0, Unpaved = 1.25, Damaged/Under Repair = 1.5)
        multiplier = 1.0
        if status == "Under repair" or status == "Under Repair" or cond == "Damaged":
            multiplier = 1.5
        elif cond == "Unpaved":
            multiplier = 1.25

        effective_cost = dist * multiplier

        if src in adjacency and dst in adjacency:
            adjacency[src].append({
                "neighbor": dst,
                "distance": dist,
                "cost": effective_cost,
                "status": status,
                "condition": cond,
            })
            # Bi-directional support by default unless specified
            is_one_way = edge.get("one_way", False)
            if not is_one_way:
                adjacency[dst].append({
                    "neighbor": src,
                    "distance": dist,
                    "cost": effective_cost,
                    "status": status,
                    "condition": cond,
                })

    goal_lat = graph_nodes[goal_id]["lat"]
    goal_lng = graph_nodes[goal_id]["lng"]

    def heuristic(node_id: str) -> float:
        node = graph_nodes[node_id]
        return haversine_distance(node["lat"], node["lng"], goal_lat, goal_lng)

    # A* Data Structures
    open_heap: List[PrioritizedNode] = []
    g_score: Dict[str, float] = {n: float("inf") for n in graph_nodes}
    f_score: Dict[str, float] = {n: float("inf") for n in graph_nodes}
    came_from: Dict[str, str] = {}
    actual_distance_from_start: Dict[str, float] = {n: 0.0 for n in graph_nodes}

    g_score[start_id] = 0.0
    f_score[start_id] = heuristic(start_id)
    initial_pnode = PrioritizedNode(f_score=f_score[start_id], g_score=0.0, node_id=start_id, parent_id=None)
    heapq.heappush(open_heap, initial_pnode)

    closed_set: Set[str] = set()
    open_set_tracker: Dict[str, float] = {start_id: f_score[start_id]}

    if tracer:
        tracer.record_step(
            current_node=start_id,
            current_f=f_score[start_id],
            current_g=0.0,
            current_h=f_score[start_id],
            open_set=open_heap,
            closed_set=closed_set,
            neighbors_evaluated=[],
            description=f"Initialized A* search at starting node '{graph_nodes[start_id].get('name', start_id)}' (h={heuristic(start_id):.2f} km).",
        )

    found = False

    while open_heap:
        current = heapq.heappop(open_heap)
        curr_id = current.node_id

        # Skip stale entries in heap
        if curr_id in closed_set:
            continue

        closed_set.add(curr_id)
        if curr_id in open_set_tracker:
            del open_set_tracker[curr_id]

        # Goal Reached!
        if curr_id == goal_id:
            found = True
            if tracer:
                tracer.record_step(
                    current_node=curr_id,
                    current_f=f_score[curr_id],
                    current_g=g_score[curr_id],
                    current_h=0.0,
                    open_set=open_heap,
                    closed_set=closed_set,
                    neighbors_evaluated=[],
                    description=f"Goal node '{graph_nodes[goal_id].get('name', goal_id)}' reached with optimal cost g={g_score[curr_id]:.2f} km.",
                )
            break

        neighbors_evaluated = []

        for edge_info in adjacency.get(curr_id, []):
            nbr = edge_info["neighbor"]
            edge_dist = edge_info["distance"]
            edge_cost = edge_info["cost"]

            if nbr in closed_set:
                neighbors_evaluated.append({
                    "neighbor_id": nbr,
                    "neighbor_name": graph_nodes[nbr].get("name", nbr),
                    "status": "Skipped (Already in Closed List)",
                    "edge_distance": edge_dist,
                    "edge_cost": edge_cost,
                })
                continue

            tentative_g = g_score[curr_id] + edge_cost
            h_nbr = heuristic(nbr)
            tentative_f = tentative_g + h_nbr

            if tentative_g < g_score[nbr]:
                came_from[nbr] = curr_id
                g_score[nbr] = tentative_g
                f_score[nbr] = tentative_f
                actual_distance_from_start[nbr] = actual_distance_from_start[curr_id] + edge_dist

                new_node = PrioritizedNode(f_score=tentative_f, g_score=tentative_g, node_id=nbr, parent_id=curr_id)
                heapq.heappush(open_heap, new_node)
                open_set_tracker[nbr] = tentative_f

                neighbors_evaluated.append({
                    "neighbor_id": nbr,
                    "neighbor_name": graph_nodes[nbr].get("name", nbr),
                    "status": "Added/Updated in Open List",
                    "g_score": round(tentative_g, 2),
                    "h_score": round(h_nbr, 2),
                    "f_score": round(tentative_f, 2),
                    "edge_distance": edge_dist,
                })
            else:
                neighbors_evaluated.append({
                    "neighbor_id": nbr,
                    "neighbor_name": graph_nodes[nbr].get("name", nbr),
                    "status": "Suboptimal path ignored",
                    "tentative_g": round(tentative_g, 2),
                    "existing_g": round(g_score[nbr], 2),
                })

        if tracer:
            tracer.record_step(
                current_node=curr_id,
                current_f=f_score[curr_id],
                current_g=g_score[curr_id],
                current_h=heuristic(curr_id),
                open_set=open_heap,
                closed_set=closed_set,
                neighbors_evaluated=neighbors_evaluated,
                description=f"Explored node '{graph_nodes[curr_id].get('name', curr_id)}' (g={g_score[curr_id]:.2f}, h={heuristic(curr_id):.2f}). Evaluated {len(neighbors_evaluated)} outgoing road(s).",
            )

    if not found:
        return AStarResult(
            found=False,
            path=[],
            path_coordinates=[],
            total_distance_km=0.0,
            estimated_travel_time_hours=0.0,
            estimated_fuel_liters=0.0,
            nodes_explored_count=len(closed_set),
            open_list_final_size=len(open_heap),
            steps_log=tracer.to_dict_list() if tracer else [],
            message=f"No valid open route exists between '{graph_nodes[start_id].get('name', start_id)}' and '{graph_nodes[goal_id].get('name', goal_id)}'. Roads may be blocked or disconnected.",
        )

    # Reconstruct optimal path
    path = []
    curr = goal_id
    while curr is not None:
        path.append(curr)
        curr = came_from.get(curr)
    path.reverse()

    path_coords = [(graph_nodes[nid]["lat"], graph_nodes[nid]["lng"]) for nid in path]
    total_km = actual_distance_from_start[goal_id]
    est_hours = total_km / max(truck_speed_kmh, 1.0)
    est_fuel = total_km * truck_fuel_rate_lpkm

    return AStarResult(
        found=True,
        path=path,
        path_coordinates=path_coords,
        total_distance_km=round(total_km, 2),
        estimated_travel_time_hours=round(est_hours, 2),
        estimated_fuel_liters=round(est_fuel, 2),
        nodes_explored_count=len(closed_set),
        open_list_final_size=len(open_heap),
        steps_log=tracer.to_dict_list() if tracer else [],
        message=f"Optimal A* path successfully computed: {len(path)} waypoints, {total_km:.2f} km.",
    )
