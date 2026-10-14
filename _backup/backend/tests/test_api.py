"""
Integration test suite for FastAPI REST endpoints.
"""

import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.database import init_db, SessionLocal
from backend.services import seed_database_if_empty


@pytest.fixture(scope="session", autouse=True)
def setup_database():
    """Initializes SQLite tables and seeds test scenario."""
    init_db()
    db = SessionLocal()
    try:
        seed_database_if_empty(db, default_scenario="cyclone")
    finally:
        db.close()


def test_health_endpoint():
    with TestClient(app) as client:
        res = client.get("/api/health")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "healthy"
        assert data["ml_free"] is True
        assert "Classical AI" in data["ai_engine"]


def test_dashboard_stats():
    with TestClient(app) as client:
        res = client.get("/api/dashboard/stats")
        assert res.status_code == 200
        data = res.json()
        assert data["total_warehouses"] >= 1
        assert data["total_affected_locations"] >= 1
        assert data["total_trucks"] >= 1


def test_plan_generation_and_pdf_export():
    with TestClient(app) as client:
        # 1. Generate plan
        res = client.post(
            "/api/plan/generate",
            json={
                "population_size": 40,
                "generations": 50,
                "mutation_rate": 0.05,
                "crossover_rate": 0.80,
            },
        )
        assert res.status_code == 200
        plan = res.json()
        assert "plan_id" in plan
        assert len(plan["truck_plans"]) >= 1
        assert plan["total_distance_km"] > 0

        plan_id = plan["plan_id"]

        # 2. Export PDF
        pdf_res = client.get(f"/api/reports/pdf/{plan_id}")
        assert pdf_res.status_code == 200
        assert pdf_res.headers["content-type"] == "application/pdf"
        assert len(pdf_res.content) > 1000  # Non-empty PDF buffer


def test_astar_visualizer_endpoint():
    with TestClient(app) as client:
        whs = client.get("/api/warehouses").json()
        affs = client.get("/api/affected-areas").json()

        assert len(whs) > 0 and len(affs) > 0
        start_id = whs[0]["id"]
        goal_id = affs[0]["id"]

        res = client.post(
            "/api/visualize/astar",
            json={"start_id": start_id, "goal_id": goal_id},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["found"] is True
        assert len(data["steps_log"]) > 0
        assert data["total_distance_km"] > 0


if __name__ == "__main__":
    init_db()
    db = SessionLocal()
    seed_database_if_empty(db, default_scenario="cyclone")
    db.close()
    test_health_endpoint()
    test_dashboard_stats()
    test_plan_generation_and_pdf_export()
    test_astar_visualizer_endpoint()
    print("All FastAPI integration tests passed successfully!")
