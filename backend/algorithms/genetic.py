"""
Pure Classical Genetic Algorithm for Disaster Relief Resource Distribution and Multi-Vehicle Routing.
Optimizes truck assignments, delivery sequences, and multi-resource allocation.
Zero Machine Learning / Deep Learning.

Specifications:
- Population Size: 100
- Generations: 300
- Mutation Rate: 5% (Swap Mutation)
- Crossover Rate: 80% (Order Crossover / OX1)
- Selection: Tournament Selection (k=4)
- Multi-Objective Fitness:
    Reward: Critical/High areas served, Resource delivered, Balanced fleet usage.
    Penalty: Overload, Fuel range violation, Long travel distance, Unserved demand.
"""

import random
import copy
import math
from typing import Dict, List, Tuple, Optional, Any
from dataclasses import dataclass, field

from .astar import haversine_distance


SEVERITY_WEIGHTS = {
    "Critical": 4.0,
    "High": 2.5,
    "Medium": 1.5,
    "Low": 1.0,
}

RESOURCE_KEYS = ["food", "water", "medicine", "blankets", "emergency_kits"]


@dataclass
class TruckRoutePlan:
    truck_id: str
    warehouse_id: str
    stops: List[str]  # Ordered sequence of affected area IDs
    distance_km: float
    travel_time_hours: float
    fuel_used_liters: float
    total_load_units: float
    capacity_limit: float
    fuel_limit: float
    overload_units: float
    fuel_overuse_liters: float
    resources_allocated: Dict[str, Dict[str, int]]  # stop_id -> {resource_type: qty}
    detailed_path_nodes: List[str]  # Full A* waypoint chain


@dataclass
class GAChromosome:
    # Representation: List of tuples (location_id, assigned_truck_id, sequence_order)
    # or direct dictionary of truck_id -> list of location_ids
    truck_routes: Dict[str, List[str]]
    fitness: float = -1.0
    total_distance_km: float = 0.0
    total_fuel_liters: float = 0.0
    total_travel_time_hours: float = 0.0
    total_resources_delivered: int = 0
    total_priority_score: float = 0.0
    total_overload_penalty: float = 0.0
    total_fuel_penalty: float = 0.0
    unserved_locations: List[str] = field(default_factory=list)
    coverage_percentage: float = 0.0


@dataclass
class GenerationMetric:
    generation: int
    best_fitness: float
    avg_fitness: float
    worst_fitness: float
    best_distance_km: float
    best_coverage_pct: float


@dataclass
class GAResult:
    best_chromosome: GAChromosome
    truck_plans: List[TruckRoutePlan]
    generation_history: List[GenerationMetric]
    total_distance_km: float
    total_fuel_liters: float
    total_time_hours: float
    overall_efficiency_pct: float
    coverage_pct: float
    total_resources_delivered: int
    total_demand_units: int
    unmet_demands: Dict[str, Dict[str, int]]
    algorithm_parameters: Dict[str, Any]
    message: str


class GeneticAlgorithmOptimizer:
    """
    Classical Genetic Algorithm Optimizer for Capacitated Multi-Depot Disaster Relief Routing.
    """

    def __init__(
        self,
        warehouses: List[Dict[str, Any]],
        affected_areas: List[Dict[str, Any]],
        trucks: List[Dict[str, Any]],
        shortest_path_matrix: Dict[Tuple[str, str], Dict[str, Any]],
        population_size: int = 100,
        generations: int = 300,
        mutation_rate: float = 0.05,
        crossover_rate: float = 0.80,
        tournament_size: int = 4,
    ):
        self.warehouses = {w["id"]: w for w in warehouses}
        self.affected_areas = {a["id"]: a for a in affected_areas}
        self.trucks = {t["id"]: t for t in trucks if t.get("status", "Available") == "Available"}
        self.shortest_path_matrix = shortest_path_matrix
        self.population_size = population_size
        self.generations = generations
        self.mutation_rate = mutation_rate
        self.crossover_rate = crossover_rate
        self.tournament_size = tournament_size

        self.affected_ids = list(self.affected_areas.keys())
        self.truck_ids = list(self.trucks.keys())

        # Precompute total demand
        self.total_demand_units = 0
        for a in self.affected_areas.values():
            demands = a.get("demands", {})
            self.total_demand_units += sum(demands.get(k, 0) for k in RESOURCE_KEYS)

    def _get_path_info(self, u: str, v: str) -> Dict[str, Any]:
        """Lookup precomputed A* path between two nodes u and v."""
        if (u, v) in self.shortest_path_matrix:
            return self.shortest_path_matrix[(u, v)]
        # Default fallback if direct path wasn't found
        return {
            "found": False,
            "distance": 9999.0,
            "time": 999.0,
            "fuel": 999.0,
            "path": [u, v],
        }

    def initialize_population(self) -> List[GAChromosome]:
        """Creates initial population of chromosomes."""
        population: List[GAChromosome] = []

        if not self.truck_ids or not self.affected_ids:
            return population

        # Seed 1: Heuristic priority-based initial assignment
        sorted_by_severity = sorted(
            self.affected_ids,
            key=lambda aid: SEVERITY_WEIGHTS.get(self.affected_areas[aid].get("severity", "Low"), 1.0),
            reverse=True,
        )
        greedy_routes = {tid: [] for tid in self.truck_ids}
        for i, aid in enumerate(sorted_by_severity):
            tid = self.truck_ids[i % len(self.truck_ids)]
            greedy_routes[tid].append(aid)
        
        c_greedy = GAChromosome(truck_routes=greedy_routes)
        self.evaluate_fitness(c_greedy)
        population.append(c_greedy)

        # Seed 2: nearest-depot assignment - every stop goes to a (least loaded) truck of the closest depot.
        by_depot: Dict[str, List[str]] = {}
        for tid in self.truck_ids:
            by_depot.setdefault(self.trucks[tid]["warehouse_id"], []).append(tid)
        depot_pos = {w: (self.warehouses[w].get("lat", 0.0), self.warehouses[w].get("lng", 0.0))
                     for w in by_depot if w in self.warehouses}
        if depot_pos and len(population) < self.population_size:
            near_routes = {tid: [] for tid in self.truck_ids}
            load = {tid: 0.0 for tid in self.truck_ids}
            for aid in sorted_by_severity:
                a = self.affected_areas[aid]
                a_lat, a_lng = a.get("lat", 0.0), a.get("lng", 0.0)
                dem = sum(a.get("demands", {}).get(k, 0) for k in RESOURCE_KEYS)
                # candidate depots by distance; take the closest whose trucks still have spare capacity
                ranked = sorted(depot_pos, key=lambda w: haversine_distance(a_lat, a_lng, *depot_pos[w]))
                chosen = None
                for w in ranked[:4]:
                    cand = min(by_depot[w], key=lambda t: load[t] / max(float(self.trucks[t].get("capacity", 1000)), 1.0))
                    if load[cand] + dem <= float(self.trucks[cand].get("capacity", 1000)) * 1.0:
                        chosen = cand
                        break
                if chosen is None:
                    chosen = min(by_depot[ranked[0]], key=lambda t: load[t])
                near_routes[chosen].append(aid)
                load[chosen] += dem
            c_near = GAChromosome(truck_routes=near_routes)
            self.evaluate_fitness(c_near)
            population.append(c_near)

        # Remaining chromosomes: Randomized permutations with multi-truck partitioning
        for _ in range(1, self.population_size):
            shuffled_locs = list(self.affected_ids)
            random.shuffle(shuffled_locs)

            routes = {tid: [] for tid in self.truck_ids}
            for loc in shuffled_locs:
                chosen_truck = random.choice(self.truck_ids)
                routes[chosen_truck].append(loc)

            chrom = GAChromosome(truck_routes=routes)
            self.evaluate_fitness(chrom)
            population.append(chrom)

        return population

    def evaluate_fitness(self, chrom: GAChromosome) -> float:
        """
        Calculates multi-objective fitness score:
        Fitness = + (Priority Weight * Demand Delivered) 
                  + (Coverage Reward)
                  - (Distance Penalty)
                  - (Fuel Overuse Penalty * 50)
                  - (Truck Overload Penalty * 50)
                  - (Unreachable Route Penalty * 500)
                  - (Fleet Imbalance Penalty * 10)
        """
        total_distance = 0.0
        total_fuel = 0.0
        total_time = 0.0
        total_delivered = 0
        total_priority_score = 0.0
        total_overload = 0.0
        total_fuel_overuse = 0.0
        unreachable_penalty = 0.0
        truck_stop_counts = []

        served_locations = set()

        for tid, stops in chrom.truck_routes.items():
            truck = self.trucks[tid]
            wh_id = truck["warehouse_id"]
            truck_cap = float(truck.get("capacity", 1000))
            truck_fuel_cap = float(truck.get("fuel_capacity", 200))
            speed = float(truck.get("average_speed", 60))
            fuel_rate = float(truck.get("fuel_consumption", 0.25))

            truck_dist = 0.0
            truck_load = 0.0
            truck_stop_counts.append(len(stops))

            if not stops:
                continue

            # Leg 1: Warehouse -> First Stop
            prev_node = wh_id
            for stop_id in stops:
                path_info = self._get_path_info(prev_node, stop_id)
                if not path_info.get("found", True) or path_info["distance"] >= 9000:
                    unreachable_penalty += 500.0

                leg_dist = path_info["distance"]
                truck_dist += leg_dist
                prev_node = stop_id

                # Demand calculation
                area = self.affected_areas[stop_id]
                sev = area.get("severity", "Low")
                weight = SEVERITY_WEIGHTS.get(sev, 1.0)
                demands = area.get("demands", {})
                area_demand_sum = sum(demands.get(k, 0) for k in RESOURCE_KEYS)

                truck_load += area_demand_sum
                total_delivered += area_demand_sum
                total_priority_score += area_demand_sum * weight
                served_locations.add(stop_id)

            # Return Leg: Last Stop -> Warehouse
            return_info = self._get_path_info(prev_node, wh_id)
            if not return_info.get("found", True) or return_info["distance"] >= 9000:
                unreachable_penalty += 500.0
            truck_dist += return_info["distance"]

            truck_time = truck_dist / max(speed, 1.0)
            truck_fuel = truck_dist * fuel_rate

            total_distance += truck_dist
            total_time += truck_time
            total_fuel += truck_fuel

            # Penalties
            if truck_load > truck_cap:
                total_overload += (truck_load - truck_cap)

            if truck_fuel > truck_fuel_cap:
                total_fuel_overuse += (truck_fuel - truck_fuel_cap)

        # Fleet balance standard deviation
        if truck_stop_counts:
            avg_stops = sum(truck_stop_counts) / len(truck_stop_counts)
            variance = sum((c - avg_stops) ** 2 for c in truck_stop_counts) / len(truck_stop_counts)
            balance_penalty = math.sqrt(variance) * 10.0
        else:
            balance_penalty = 0.0

        unserved = [aid for aid in self.affected_ids if aid not in served_locations]
        coverage_ratio = len(served_locations) / max(len(self.affected_ids), 1)

        # Multi-objective composite fitness
        raw_fitness = (
            (total_priority_score * 3.0)
            + (coverage_ratio * 2000.0)
            - (total_distance * 1.5)
            - (total_overload * 80.0)
            - (total_fuel_overuse * 100.0)
            - unreachable_penalty
            - balance_penalty
            - (len(unserved) * 300.0)
        )

        # Normalize fitness to be non-negative
        fitness = max(raw_fitness, 0.01)

        chrom.fitness = round(fitness, 2)
        chrom.total_distance_km = round(total_distance, 2)
        chrom.total_fuel_liters = round(total_fuel, 2)
        chrom.total_travel_time_hours = round(total_time, 2)
        chrom.total_resources_delivered = total_delivered
        chrom.total_priority_score = round(total_priority_score, 2)
        chrom.total_overload_penalty = round(total_overload, 2)
        chrom.total_fuel_penalty = round(total_fuel_overuse, 2)
        chrom.unserved_locations = unserved
        chrom.coverage_percentage = round(coverage_ratio * 100.0, 1)

        return chrom.fitness

    def tournament_selection(self, population: List[GAChromosome]) -> GAChromosome:
        """Tournament selection with size k."""
        k = min(self.tournament_size, len(population))
        contestants = random.sample(population, k)
        return max(contestants, key=lambda c: c.fitness)

    def order_crossover_ox1(
        self, parent1: GAChromosome, parent2: GAChromosome
    ) -> Tuple[GAChromosome, GAChromosome]:
        """
        Order Crossover (OX1) adapted for multi-vehicle partition routing.
        Preserves relative ordering and guarantees that every affected location
        appears exactly once without duplicates.
        """
        if random.random() > self.crossover_rate or len(self.affected_ids) <= 1:
            return copy.deepcopy(parent1), copy.deepcopy(parent2)

        # Flatten chromosomes into (location, truck_id) lists
        flat1 = []
        for tid, locs in parent1.truck_routes.items():
            for loc in locs:
                flat1.append((loc, tid))

        flat2 = []
        for tid, locs in parent2.truck_routes.items():
            for loc in locs:
                flat2.append((loc, tid))

        if len(flat1) != len(self.affected_ids) or len(flat2) != len(self.affected_ids):
            # Fallback if any unassigned
            flat1 = [(aid, random.choice(self.truck_ids)) for aid in self.affected_ids]
            flat2 = [(aid, random.choice(self.truck_ids)) for aid in self.affected_ids]

        n = len(self.affected_ids)
        idx1, idx2 = sorted(random.sample(range(n), 2))

        def make_child(p1_list, p2_list):
            child_locs = [None] * n
            child_trucks = [None] * n
            used_locs = set()

            # Copy slice from p1
            for i in range(idx1, idx2 + 1):
                loc, tid = p1_list[i]
                child_locs[i] = loc
                child_trucks[i] = tid
                used_locs.add(loc)

            # Fill remaining from p2 in order
            p2_cursor = 0
            for i in range(n):
                if child_locs[i] is None:
                    while p2_cursor < n and p2_list[p2_cursor][0] in used_locs:
                        p2_cursor += 1
                    if p2_cursor < n:
                        loc, tid = p2_list[p2_cursor]
                        child_locs[i] = loc
                        child_trucks[i] = tid
                        used_locs.add(loc)
                        p2_cursor += 1
                    else:
                        # Safety fallback
                        for aid in self.affected_ids:
                            if aid not in used_locs:
                                child_locs[i] = aid
                                child_trucks[i] = random.choice(self.truck_ids)
                                used_locs.add(aid)
                                break

            # Reconstruct truck_routes dict
            routes = {tid: [] for tid in self.truck_ids}
            for i in range(n):
                loc = child_locs[i]
                tid = child_trucks[i] if child_trucks[i] in routes else self.truck_ids[0]
                if loc:
                    routes[tid].append(loc)

            child = GAChromosome(truck_routes=routes)
            self.evaluate_fitness(child)
            return child

        child1 = make_child(flat1, flat2)
        child2 = make_child(flat2, flat1)
        return child1, child2

    def swap_mutation(self, chrom: GAChromosome) -> GAChromosome:
        """
        Swap Mutation (5% rate):
        Swaps two locations between routes or changes a location's assigned truck.
        """
        if random.random() > self.mutation_rate or not self.affected_ids:
            return chrom

        mutated_routes = {tid: list(locs) for tid, locs in chrom.truck_routes.items()}
        non_empty_trucks = [tid for tid, locs in mutated_routes.items() if locs]

        if not non_empty_trucks:
            return chrom

        mutation_type = random.choice(["swap_two_nodes", "reassign_truck", "reverse_subsequence"])

        if mutation_type == "swap_two_nodes" and len(self.affected_ids) >= 2:
            t1 = random.choice(non_empty_trucks)
            t2 = random.choice(list(mutated_routes.keys()))
            if mutated_routes[t1]:
                idx1 = random.randint(0, len(mutated_routes[t1]) - 1)
                loc1 = mutated_routes[t1].pop(idx1)
                if mutated_routes[t2]:
                    idx2 = random.randint(0, len(mutated_routes[t2]))
                    mutated_routes[t2].insert(idx2, loc1)
                else:
                    mutated_routes[t2].append(loc1)

        elif mutation_type == "reassign_truck":
            t_src = random.choice(non_empty_trucks)
            t_dst = random.choice(self.truck_ids)
            if mutated_routes[t_src]:
                loc = mutated_routes[t_src].pop(random.randint(0, len(mutated_routes[t_src]) - 1))
                mutated_routes[t_dst].append(loc)

        elif mutation_type == "reverse_subsequence":
            t = random.choice(non_empty_trucks)
            if len(mutated_routes[t]) >= 2:
                i1, i2 = sorted(random.sample(range(len(mutated_routes[t])), 2))
                mutated_routes[t][i1 : i2 + 1] = reversed(mutated_routes[t][i1 : i2 + 1])

        mutated_chrom = GAChromosome(truck_routes=mutated_routes)
        self.evaluate_fitness(mutated_chrom)
        return mutated_chrom

    def run(self) -> GAResult:
        """
        Executes Genetic Algorithm optimization across 300 generations.
        Returns detailed telemetry, convergence curve, and optimal truck dispatch schedules.
        """
        if not self.truck_ids or not self.affected_ids:
            empty_chrom = GAChromosome(truck_routes={})
            return GAResult(
                best_chromosome=empty_chrom,
                truck_plans=[],
                generation_history=[],
                total_distance_km=0.0,
                total_fuel_liters=0.0,
                total_time_hours=0.0,
                overall_efficiency_pct=0.0,
                coverage_pct=0.0,
                total_resources_delivered=0,
                total_demand_units=0,
                unmet_demands={},
                algorithm_parameters={
                    "population_size": self.population_size,
                    "generations": self.generations,
                    "mutation_rate": self.mutation_rate,
                    "crossover_rate": self.crossover_rate,
                    "selection": "Tournament Selection",
                    "crossover": "Order Crossover (OX1)",
                    "mutation": "Swap Mutation",
                },
                message="No available trucks or disaster locations provided.",
            )

        population = self.initialize_population()
        history: List[GenerationMetric] = []

        best_ever = copy.deepcopy(max(population, key=lambda c: c.fitness))

        for gen in range(1, self.generations + 1):
            next_generation: List[GAChromosome] = []

            # Elitism: Keep top 2 best chromosomes
            sorted_pop = sorted(population, key=lambda c: c.fitness, reverse=True)
            next_generation.append(copy.deepcopy(sorted_pop[0]))
            if len(sorted_pop) > 1:
                next_generation.append(copy.deepcopy(sorted_pop[1]))

            # Produce offspring
            while len(next_generation) < self.population_size:
                p1 = self.tournament_selection(population)
                p2 = self.tournament_selection(population)
                c1, c2 = self.order_crossover_ox1(p1, p2)
                c1 = self.swap_mutation(c1)
                c2 = self.swap_mutation(c2)
                next_generation.append(c1)
                if len(next_generation) < self.population_size:
                    next_generation.append(c2)

            population = next_generation

            current_best = max(population, key=lambda c: c.fitness)
            if current_best.fitness > best_ever.fitness:
                best_ever = copy.deepcopy(current_best)

            # Record telemetry every generation (or sampled if necessary)
            fits = [c.fitness for c in population]
            history.append(
                GenerationMetric(
                    generation=gen,
                    best_fitness=round(best_ever.fitness, 2),
                    avg_fitness=round(sum(fits) / len(fits), 2),
                    worst_fitness=round(min(fits), 2),
                    best_distance_km=round(best_ever.total_distance_km, 2),
                    best_coverage_pct=round(best_ever.coverage_percentage, 1),
                )
            )

        # Build detailed execution plans and resource allocation breakdown
        truck_plans, unmet = self._build_detailed_truck_plans(best_ever)

        # Overall delivery efficiency metric (composite of coverage, capacity compliance, and distance)
        eff_pct = min(
            100.0,
            max(
                0.0,
                (best_ever.coverage_percentage * 0.5)
                + (max(0.0, 100.0 - (best_ever.total_overload_penalty / max(best_ever.total_resources_delivered, 1) * 100)) * 0.3)
                + (max(0.0, 100.0 - (best_ever.total_distance_km / 50.0)) * 0.2),
            ),
        )

        return GAResult(
            best_chromosome=best_ever,
            truck_plans=truck_plans,
            generation_history=history,
            total_distance_km=best_ever.total_distance_km,
            total_fuel_liters=best_ever.total_fuel_liters,
            total_time_hours=best_ever.total_travel_time_hours,
            overall_efficiency_pct=round(eff_pct, 1),
            coverage_pct=best_ever.coverage_percentage,
            total_resources_delivered=best_ever.total_resources_delivered,
            total_demand_units=self.total_demand_units,
            unmet_demands=unmet,
            algorithm_parameters={
                "population_size": self.population_size,
                "generations": self.generations,
                "mutation_rate": self.mutation_rate,
                "crossover_rate": self.crossover_rate,
                "selection": "Tournament Selection (k=4)",
                "crossover": "Order Crossover (OX1)",
                "mutation": "Swap Mutation (5%)",
            },
            message=f"Genetic Algorithm optimization completed ({self.generations} generations). Best fitness: {best_ever.fitness:.2f}.",
        )

    def _build_detailed_truck_plans(
        self, chromosome: GAChromosome
    ) -> Tuple[List[TruckRoutePlan], Dict[str, Dict[str, int]]]:
        """Constructs detailed turn-by-turn route and resource allocation for each truck."""
        plans: List[TruckRoutePlan] = []
        allocated_to_areas: Dict[str, Dict[str, int]] = {aid: {k: 0 for k in RESOURCE_KEYS} for aid in self.affected_ids}

        # Track warehouse remaining stocks
        wh_stocks = {
            wid: {k: int(w.get("stocks", {}).get(k, 0)) for k in RESOURCE_KEYS}
            for wid, w in self.warehouses.items()
        }

        for tid, stops in chromosome.truck_routes.items():
            if not stops:
                continue

            truck = self.trucks[tid]
            wid = truck["warehouse_id"]
            truck_cap = float(truck.get("capacity", 1000))
            truck_fuel_cap = float(truck.get("fuel_capacity", 200))
            speed = float(truck.get("average_speed", 60))
            fuel_rate = float(truck.get("fuel_consumption", 0.25))

            dist = 0.0
            full_path_nodes = [wid]
            allocations: Dict[str, Dict[str, int]] = {}
            current_truck_load = 0

            prev_node = wid
            for stop_id in stops:
                path_info = self._get_path_info(prev_node, stop_id)
                dist += path_info.get("distance", 0.0)
                # Append intermediate A* nodes avoiding duplicates
                sub_path = path_info.get("path", [prev_node, stop_id])
                if len(sub_path) > 1:
                    full_path_nodes.extend(sub_path[1:])
                else:
                    full_path_nodes.append(stop_id)

                prev_node = stop_id

                # Allocate resources respecting warehouse stock and truck capacity
                area = self.affected_areas[stop_id]
                demands = area.get("demands", {})
                allocations[stop_id] = {}

                for rk in RESOURCE_KEYS:
                    dem = int(demands.get(rk, 0))
                    avail_stock = wh_stocks[wid].get(rk, 0)
                    # Allocate what we can
                    alloc_qty = min(dem, avail_stock)
                    # Check truck capacity constraint
                    if current_truck_load + alloc_qty > truck_cap:
                        alloc_qty = max(0, int(truck_cap - current_truck_load))

                    allocations[stop_id][rk] = alloc_qty
                    wh_stocks[wid][rk] -= alloc_qty
                    allocated_to_areas[stop_id][rk] += alloc_qty
                    current_truck_load += alloc_qty

            # Return to warehouse
            return_info = self._get_path_info(prev_node, wid)
            dist += return_info.get("distance", 0.0)
            sub_return = return_info.get("path", [prev_node, wid])
            if len(sub_return) > 1:
                full_path_nodes.extend(sub_return[1:])

            time_hrs = dist / max(speed, 1.0)
            fuel_l = dist * fuel_rate
            overload = max(0.0, current_truck_load - truck_cap)
            fuel_over = max(0.0, fuel_l - truck_fuel_cap)

            plans.append(
                TruckRoutePlan(
                    truck_id=tid,
                    warehouse_id=wid,
                    stops=stops,
                    distance_km=round(dist, 2),
                    travel_time_hours=round(time_hrs, 2),
                    fuel_used_liters=round(fuel_l, 2),
                    total_load_units=current_truck_load,
                    capacity_limit=truck_cap,
                    fuel_limit=truck_fuel_cap,
                    overload_units=round(overload, 2),
                    fuel_overuse_liters=round(fuel_over, 2),
                    resources_allocated=allocations,
                    detailed_path_nodes=full_path_nodes,
                )
            )

        # Unmet demands calculation
        unmet: Dict[str, Dict[str, int]] = {}
        for aid, area in self.affected_areas.items():
            demands = area.get("demands", {})
            unmet[aid] = {}
            for rk in RESOURCE_KEYS:
                dem = int(demands.get(rk, 0))
                got = allocated_to_areas.get(aid, {}).get(rk, 0)
                if dem > got:
                    unmet[aid][rk] = dem - got

        return plans, unmet
