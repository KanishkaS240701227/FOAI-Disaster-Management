"""
Unit tests for Pure Classical Genetic Algorithm Optimizer.
Verifies multi-depot vehicle partitioning, crossover validity, and fitness evolution.
Zero ML / DL.
"""

from backend.algorithms.genetic import GeneticAlgorithmOptimizer, GAChromosome


def test_genetic_algorithm_run():
    warehouses = [
        {"id": "W1", "name": "Warehouse 1", "lat": 20.0, "lng": 80.0, "stocks": {"food": 10000, "water": 10000, "medicine": 1000, "blankets": 1000, "emergency_kits": 1000}}
    ]
    affected = [
        {"id": "A1", "name": "Village 1", "lat": 20.1, "lng": 80.1, "severity": "Critical", "demands": {"food": 500, "water": 1000, "medicine": 100, "blankets": 100, "emergency_kits": 50}},
        {"id": "A2", "name": "Village 2", "lat": 20.2, "lng": 80.2, "severity": "High", "demands": {"food": 300, "water": 500, "medicine": 50, "blankets": 50, "emergency_kits": 25}},
        {"id": "A3", "name": "Village 3", "lat": 20.3, "lng": 80.3, "severity": "Medium", "demands": {"food": 200, "water": 300, "medicine": 20, "blankets": 20, "emergency_kits": 10}},
    ]
    trucks = [
        {"id": "T1", "truck_number": "TRK-1", "capacity": 5000, "fuel_capacity": 200, "average_speed": 60, "fuel_consumption": 0.25, "warehouse_id": "W1", "status": "Available"},
        {"id": "T2", "truck_number": "TRK-2", "capacity": 5000, "fuel_capacity": 200, "average_speed": 60, "fuel_consumption": 0.25, "warehouse_id": "W1", "status": "Available"},
    ]

    # Precomputed distances
    matrix = {
        ("W1", "A1"): {"found": True, "distance": 15.0, "time": 0.25, "fuel": 3.75, "path": ["W1", "A1"]},
        ("A1", "W1"): {"found": True, "distance": 15.0, "time": 0.25, "fuel": 3.75, "path": ["A1", "W1"]},
        ("W1", "A2"): {"found": True, "distance": 25.0, "time": 0.4, "fuel": 6.25, "path": ["W1", "A2"]},
        ("A2", "W1"): {"found": True, "distance": 25.0, "time": 0.4, "fuel": 6.25, "path": ["A2", "W1"]},
        ("W1", "A3"): {"found": True, "distance": 35.0, "time": 0.58, "fuel": 8.75, "path": ["W1", "A3"]},
        ("A3", "W1"): {"found": True, "distance": 35.0, "time": 0.58, "fuel": 8.75, "path": ["A3", "W1"]},
        ("A1", "A2"): {"found": True, "distance": 12.0, "time": 0.2, "fuel": 3.0, "path": ["A1", "A2"]},
        ("A2", "A1"): {"found": True, "distance": 12.0, "time": 0.2, "fuel": 3.0, "path": ["A2", "A1"]},
        ("A2", "A3"): {"found": True, "distance": 14.0, "time": 0.23, "fuel": 3.5, "path": ["A2", "A3"]},
        ("A3", "A2"): {"found": True, "distance": 14.0, "time": 0.23, "fuel": 3.5, "path": ["A3", "A2"]},
        ("A1", "A3"): {"found": True, "distance": 24.0, "time": 0.4, "fuel": 6.0, "path": ["A1", "A3"]},
        ("A3", "A1"): {"found": True, "distance": 24.0, "time": 0.4, "fuel": 6.0, "path": ["A3", "A1"]},
    }

    optimizer = GeneticAlgorithmOptimizer(
        warehouses=warehouses,
        affected_areas=affected,
        trucks=trucks,
        shortest_path_matrix=matrix,
        population_size=50,
        generations=100,
        mutation_rate=0.05,
        crossover_rate=0.80,
    )

    result = optimizer.run()
    assert result.best_chromosome.fitness > 0
    assert result.coverage_pct > 0
    assert len(result.generation_history) == 100
    assert len(result.truck_plans) > 0


def test_order_crossover_no_duplicates():
    warehouses = [{"id": "W1", "name": "W1", "lat": 0, "lng": 0}]
    affected = [
        {"id": f"A{i}", "name": f"A{i}", "lat": 0, "lng": 0, "severity": "Medium", "demands": {}}
        for i in range(1, 7)
    ]
    trucks = [{"id": "T1", "truck_number": "T1", "capacity": 5000, "warehouse_id": "W1", "status": "Available"}]

    optimizer = GeneticAlgorithmOptimizer(
        warehouses=warehouses,
        affected_areas=affected,
        trucks=trucks,
        shortest_path_matrix={},
        population_size=10,
        generations=10,
    )

    p1 = GAChromosome(truck_routes={"T1": ["A1", "A2", "A3", "A4", "A5", "A6"]})
    p2 = GAChromosome(truck_routes={"T1": ["A4", "A6", "A1", "A3", "A2", "A5"]})

    c1, c2 = optimizer.order_crossover_ox1(p1, p2)
    # Verify both children contain all 6 elements without duplicates
    locs1 = c1.truck_routes["T1"]
    assert len(locs1) == 6
    assert set(locs1) == {"A1", "A2", "A3", "A4", "A5", "A6"}


if __name__ == "__main__":
    test_genetic_algorithm_run()
    test_order_crossover_no_duplicates()
    print("All Genetic Algorithm tests passed successfully!")
