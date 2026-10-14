"""
Service layer for Disaster Relief Resource Distribution Planner.
Orchestrates Classical A* Search, Genetic Algorithm, Scenario Management, and Data Integrity.
"""

import json
from datetime import datetime
from typing import Dict, List, Any, Tuple, Optional
from sqlalchemy.orm import Session

from . import models, schemas
from .algorithms.astar import astar_search
from .algorithms.genetic import GeneticAlgorithmOptimizer, RESOURCE_KEYS
from .algorithms.graph import ReliefGraph
from .scenarios import SCENARIOS


def seed_database_if_empty(db: Session, default_scenario: str = "cyclone"):
    """Seeds the database with a default disaster scenario if tables are empty."""
    if db.query(models.Warehouse).count() == 0:
        load_scenario_into_db(db, default_scenario)


def load_scenario_into_db(db: Session, scenario_key: str) -> Dict[str, Any]:
    """Clears existing data and loads a realistic disaster scenario preset."""
    if scenario_key not in SCENARIOS:
        scenario_key = "cyclone"
    
    scenario = SCENARIOS[scenario_key]

    # Clear current data
    db.query(models.Road).delete()
    db.query(models.Truck).delete()
    db.query(models.AffectedArea).delete()
    db.query(models.Warehouse).delete()
    db.commit()

    # Insert Warehouses
    for w in scenario["warehouses"]:
        wh_model = models.Warehouse(
            id=w["id"],
            name=w["name"],
            latitude=w["latitude"],
            longitude=w["longitude"],
            food_stock=w["food_stock"],
            water_stock=w["water_stock"],
            medicine_stock=w["medicine_stock"],
            blanket_stock=w["blanket_stock"],
            emergency_kit_stock=w["emergency_kit_stock"],
        )
        db.add(wh_model)

    # Insert Affected Areas
    for a in scenario["affected_areas"]:
        area_model = models.AffectedArea(
            id=a["id"],
            name=a["name"],
            latitude=a["latitude"],
            longitude=a["longitude"],
            population=a["population"],
            severity=a["severity"],
            food_demand=a["food_demand"],
            water_demand=a["water_demand"],
            medicine_demand=a["medicine_demand"],
            blanket_demand=a["blanket_demand"],
            emergency_kit_demand=a["emergency_kit_demand"],
        )
        db.add(area_model)

    # Insert Roads
    for r in scenario["roads"]:
        road_model = models.Road(
            source_id=r["source_id"],
            destination_id=r["destination_id"],
            distance=r["distance"],
            travel_time=r["travel_time"],
            road_condition=r.get("road_condition", "Paved"),
            road_status=r.get("road_status", "Open"),
        )
        db.add(road_model)

    # Insert Trucks
    for t in scenario["trucks"]:
        truck_model = models.Truck(
            id=t["id"],
            truck_number=t["truck_number"],
            capacity=t["capacity"],
            fuel_capacity=t["fuel_capacity"],
            average_speed=t["average_speed"],
            fuel_consumption=t["fuel_consumption"],
            current_warehouse_id=t["current_warehouse_id"],
            status=t.get("status", "Available"),
        )
        db.add(truck_model)

    db.commit()
    return {
        "success": True,
        "scenario_key": scenario_key,
        "name": scenario["name"],
        "description": scenario["description"],
    }


def get_dashboard_statistics(db: Session) -> schemas.DashboardStats:
    """Aggregates real-time statistics for the dashboard view."""
    warehouses = db.query(models.Warehouse).all()
    affected = db.query(models.AffectedArea).all()
    trucks = db.query(models.Truck).all()

    avail_trucks = sum(1 for t in trucks if t.status == "Available")
    busy_trucks = sum(1 for t in trucks if t.status == "Busy")

    tot_food_stock = sum(w.food_stock for w in warehouses)
    tot_water_stock = sum(w.water_stock for w in warehouses)
    tot_med_stock = sum(w.medicine_stock for w in warehouses)
    tot_blanket_stock = sum(w.blanket_stock for w in warehouses)
    tot_kit_stock = sum(w.emergency_kit_stock for w in warehouses)

    tot_food_dem = sum(a.food_demand for a in affected)
    tot_water_dem = sum(a.water_demand for a in affected)
    tot_med_dem = sum(a.medicine_demand for a in affected)
    tot_blanket_dem = sum(a.blanket_demand for a in affected)
    tot_kit_dem = sum(a.emergency_kit_demand for a in affected)

    # Get latest plan for travel stats
    latest_plan = db.query(models.DistributionPlan).order_by(models.DistributionPlan.created_at.desc()).first()

    return schemas.DashboardStats(
        total_warehouses=len(warehouses),
        total_affected_locations=len(affected),
        available_trucks=avail_trucks,
        busy_trucks=busy_trucks,
        total_trucks=len(trucks),
        pending_requests_count=len(affected),
        total_resources_stock=schemas.ResourceBundle(
            food=tot_food_stock,
            water=tot_water_stock,
            medicine=tot_med_stock,
            blankets=tot_blanket_stock,
            emergency_kits=tot_kit_stock,
        ),
        total_resources_demand=schemas.ResourceBundle(
            food=tot_food_dem,
            water=tot_water_dem,
            medicine=tot_med_dem,
            blankets=tot_blanket_dem,
            emergency_kits=tot_kit_dem,
        ),
        total_travel_distance_km=latest_plan.total_distance_km if latest_plan else 0.0,
        estimated_fuel_usage_liters=latest_plan.total_fuel_liters if latest_plan else 0.0,
        overall_delivery_efficiency_pct=latest_plan.overall_efficiency_pct if latest_plan else 0.0,
        coverage_percentage=latest_plan.coverage_pct if latest_plan else 0.0,
    )


def generate_distribution_plan(
    db: Session, request: schemas.PlanGenerationRequest
) -> schemas.DistributionPlanResponse:
    """
    Core Pipeline:
    1. Read warehouses, affected areas, road network, and trucks from DB.
    2. Build ReliefGraph and validate connectivity.
    3. Run Classical A* Search to compute all-pairs shortest paths avoiding blocked roads.
    4. Run Classical Genetic Algorithm to optimize fleet schedules and resource allocation.
    5. Assemble detailed output and persist to DB.
    """
    warehouses_db = db.query(models.Warehouse).all()
    affected_db = db.query(models.AffectedArea).all()
    roads_db = db.query(models.Road).all()
    trucks_db = db.query(models.Truck).all()

    warnings: List[str] = []

    # Validations
    if not warehouses_db:
        warnings.append("No warehouses exist in database. Please create at least one warehouse.")
    if not affected_db:
        warnings.append("No affected disaster areas registered. Please create disaster locations.")
    if not trucks_db:
        warnings.append("No trucks available in fleet. Please add trucks.")

    wh_list = [w.to_dict() for w in warehouses_db]
    aff_list = [a.to_dict() for a in affected_db]
    road_list = [r.to_dict() for r in roads_db]
    truck_list = [t.to_dict() for t in trucks_db]

    # Map name lookups
    name_lookup = {w["id"]: w["name"] for w in wh_list}
    name_lookup.update({a["id"]: a["name"] for a in aff_list})
    coord_lookup = {w["id"]: [w["lat"], w["lng"]] for w in wh_list}
    coord_lookup.update({a["id"]: [a["lat"], a["lng"]] for a in aff_list})
    severity_lookup = {a["id"]: a["severity"] for a in aff_list}

    # Step 1: Graph Network validation & All-Pairs A*
    relief_graph = ReliefGraph(wh_list, aff_list, road_list)
    validation = relief_graph.validate_network()

    if validation["unreachable_affected_areas"]:
        for unreach in validation["unreachable_affected_areas"]:
            warnings.append(
                f"Location '{unreach['name']}' ({unreach['severity']} severity) is isolated or cut off by blocked roads!"
            )

    # Step 2: Run A* search matrix
    shortest_path_matrix = relief_graph.compute_all_pairs_astar()

    # Step 3: Run Genetic Algorithm Optimizer
    ga_optimizer = GeneticAlgorithmOptimizer(
        warehouses=wh_list,
        affected_areas=aff_list,
        trucks=truck_list,
        shortest_path_matrix=shortest_path_matrix,
        population_size=request.population_size,
        generations=request.generations,
        mutation_rate=request.mutation_rate,
        crossover_rate=request.crossover_rate,
    )

    ga_result = ga_optimizer.run()

    # Format TruckPlanOutput list
    truck_outputs: List[schemas.TruckPlanOutput] = []

    truck_map = {t["id"]: t for t in truck_list}
    wh_map = {w["id"]: w for w in wh_list}

    for tp in ga_result.truck_plans:
        t_info = truck_map.get(tp.truck_id, {})
        w_info = wh_map.get(tp.warehouse_id, {})
        
        assigned_names = [name_lookup.get(loc_id, loc_id) for loc_id in tp.stops]

        # Calculate polyline coordinates for Leaflet
        route_coords = [coord_lookup.get(nid, [0.0, 0.0]) for nid in tp.detailed_path_nodes if nid in coord_lookup]

        # Aggregate total delivered by this truck
        tot_del = schemas.ResourceBundle()
        stops_detail: List[schemas.StopAllocation] = []

        for stop_id in tp.stops:
            alloc_dict = tp.resources_allocated.get(stop_id, {})
            unmet_dict = ga_result.unmet_demands.get(stop_id, {})

            delivered_bundle = schemas.ResourceBundle(**{k: alloc_dict.get(k, 0) for k in RESOURCE_KEYS})
            unmet_bundle = schemas.ResourceBundle(**{k: unmet_dict.get(k, 0) for k in RESOURCE_KEYS})

            tot_del.food += delivered_bundle.food
            tot_del.water += delivered_bundle.water
            tot_del.medicine += delivered_bundle.medicine
            tot_del.blankets += delivered_bundle.blankets
            tot_del.emergency_kits += delivered_bundle.emergency_kits

            stops_detail.append(
                schemas.StopAllocation(
                    location_id=stop_id,
                    location_name=name_lookup.get(stop_id, stop_id),
                    severity=severity_lookup.get(stop_id, "Medium"),
                    delivered=delivered_bundle,
                    unmet=unmet_bundle,
                )
            )

        cap_util = (tp.total_load_units / max(tp.capacity_limit, 1.0)) * 100.0

        # Determine priority level of assigned stops
        max_sev = "Low"
        for stop_id in tp.stops:
            s = severity_lookup.get(stop_id, "Low")
            if s == "Critical":
                max_sev = "Critical"
                break
            elif s == "High" and max_sev != "Critical":
                max_sev = "High"
            elif s == "Medium" and max_sev not in ["Critical", "High"]:
                max_sev = "Medium"

        truck_outputs.append(
            schemas.TruckPlanOutput(
                truck_id=tp.truck_id,
                truck_number=t_info.get("truck_number", tp.truck_id),
                warehouse_id=tp.warehouse_id,
                warehouse_name=w_info.get("name", tp.warehouse_id),
                assigned_locations=tp.stops,
                assigned_location_names=assigned_names,
                optimal_route_sequence=tp.detailed_path_nodes,
                optimal_route_coordinates=route_coords,
                distance_km=tp.distance_km,
                estimated_time_hours=tp.travel_time_hours,
                fuel_usage_liters=tp.fuel_used_liters,
                total_load_units=tp.total_load_units,
                capacity_limit=tp.capacity_limit,
                capacity_utilization_pct=round(cap_util, 1),
                fuel_capacity_limit=tp.fuel_limit,
                overload_units=tp.overload_units,
                fuel_overuse_liters=tp.fuel_overuse_liters,
                resources_delivered=tot_del,
                priority_level=max_sev,
                stops_detail=stops_detail,
            )
        )

    # Format Generation history
    gen_hist = [
        {
            "generation": m.generation,
            "best_fitness": m.best_fitness,
            "avg_fitness": m.avg_fitness,
            "worst_fitness": m.worst_fitness,
            "best_distance_km": m.best_distance_km,
            "best_coverage_pct": m.best_coverage_pct,
        }
        for m in ga_result.generation_history
    ]

    # Save to database
    plan_record = models.DistributionPlan(
        name=request.scenario_name or "Generated Disaster Plan",
        total_distance_km=ga_result.total_distance_km,
        total_fuel_liters=ga_result.total_fuel_liters,
        total_travel_time_hours=ga_result.total_time_hours,
        overall_efficiency_pct=ga_result.overall_efficiency_pct,
        coverage_pct=ga_result.coverage_pct,
        total_resources_delivered=ga_result.total_resources_delivered,
        plan_data_json=json.dumps({
            "truck_plans": [t.model_dump() for t in truck_outputs],
            "generation_history": gen_hist,
            "unmet_demands": ga_result.unmet_demands,
            "algorithm_parameters": ga_result.algorithm_parameters,
            "warnings": warnings,
        }),
    )
    db.add(plan_record)
    db.commit()

    return schemas.DistributionPlanResponse(
        plan_id=plan_record.id,
        scenario_name=plan_record.name,
        created_at=plan_record.created_at.isoformat(),
        total_distance_km=ga_result.total_distance_km,
        total_fuel_liters=ga_result.total_fuel_liters,
        total_travel_time_hours=ga_result.total_time_hours,
        overall_efficiency_pct=ga_result.overall_efficiency_pct,
        coverage_pct=ga_result.coverage_pct,
        total_resources_delivered=ga_result.total_resources_delivered,
        total_demand_units=ga_result.total_demand_units,
        truck_plans=truck_outputs,
        generation_history=gen_hist,
        unmet_demands=ga_result.unmet_demands,
        algorithm_parameters=ga_result.algorithm_parameters,
        warnings=warnings,
        message=f"Distribution Plan generated successfully using A* Search & Genetic Algorithm ({request.generations} generations).",
    )


def run_astar_trace(
    db: Session, request: schemas.AStarVisualizerRequest
) -> schemas.AStarVisualizerResponse:
    """Executes A* search with full step-by-step execution trace."""
    warehouses_db = db.query(models.Warehouse).all()
    affected_db = db.query(models.AffectedArea).all()
    roads_db = db.query(models.Road).all()

    wh_list = [w.to_dict() for w in warehouses_db]
    aff_list = [a.to_dict() for a in affected_db]
    road_list = [r.to_dict() for r in roads_db]

    relief_graph = ReliefGraph(wh_list, aff_list, road_list)
    nodes = relief_graph.nodes
    edges = [
        {
            "source": r["source_id"],
            "destination": r["destination_id"],
            "distance": r["distance"],
            "status": r["road_status"],
            "condition": r["road_condition"],
            "one_way": r["one_way"],
        }
        for r in road_list
    ]

    res = astar_search(
        graph_nodes=nodes,
        graph_edges=edges,
        start_id=request.start_id,
        goal_id=request.goal_id,
        truck_speed_kmh=request.truck_speed_kmh or 60.0,
        truck_fuel_rate_lpkm=request.truck_fuel_rate_lpkm or 0.25,
        trace_steps=True,
    )

    path_names = [nodes.get(nid, {}).get("name", nid) for nid in res.path]
    coords = [[lat, lng] for lat, lng in res.path_coordinates]

    return schemas.AStarVisualizerResponse(
        found=res.found,
        path=res.path,
        path_names=path_names,
        path_coordinates=coords,
        total_distance_km=res.total_distance_km,
        estimated_travel_time_hours=res.estimated_travel_time_hours,
        estimated_fuel_liters=res.estimated_fuel_liters,
        nodes_explored_count=res.nodes_explored_count,
        open_list_final_size=res.open_list_final_size,
        steps_log=res.steps_log,
        message=res.message,
    )
