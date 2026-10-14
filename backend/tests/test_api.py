"""Integration tests for the Chennai relief API (no network access needed)."""
import pytest
from fastapi.testclient import TestClient

import backend.main as main_module
from backend.main import app


@pytest.fixture(scope="module")
def client():
    # never hit the network from tests
    main_module.osm_import.start_background_import = lambda on_done=None: False
    main_module.ENGINE.refresh_live = lambda: main_module.ENGINE.live
    with TestClient(app) as c:
        assert c.post("/api/scenarios/load/michaung_2023").status_code == 200
        yield c


def test_health(client):
    d = client.get("/api/health").json()
    assert d["status"] == "healthy" and d["ml_free"] is True and "Classical AI" in d["ai_engine"]


def test_geography_covers_chennai_and_suburbs(client):
    z = client.get("/api/geo/zones").json()["features"]
    ids = {f["properties"]["id"] for f in z}
    assert {f"Z{n:02d}" for n in range(1, 16)} <= ids
    assert {"S-AVADI", "S-PALLAVARAM", "S-CHROMPET", "S-TAMBARAM"} <= ids
    assert len(client.get("/api/geo/hotspots").json()) >= 50


def test_state_and_hazards(client):
    st = client.get("/api/state").json()
    assert st["scenario"]["key"] == "michaung_2023"
    assert len(st["warehouses"]) >= 15 and len(st["trucks"]) >= 20 and len(st["affected_areas"]) > 10
    assert st["hazard"]["summary"]["meter"] > 50
    assert set(st["hazard"]["zones"]) >= {"Z01", "S-TAMBARAM"}
    assert st["network"]["state"]["slow"] > 0


def test_quake_scenario_scores_quake(client):
    client.post("/api/scenarios/load/quake_drill")
    h = client.get("/api/hazards").json()
    assert max(z["quake"] for z in h["zones"].values()) > 30
    assert all(a["hazard"] in ("earthquake", "wind", "flood") for a in client.get("/api/affected-areas").json())
    client.post("/api/scenarios/load/michaung_2023")


def test_plan_has_etas_and_routes_and_pdf(client):
    res = client.post("/api/plan/generate", json={"population_size": 40, "generations": 40, "max_areas": 14})
    assert res.status_code == 200, res.text
    plan = res.json()
    assert plan["truck_plans"] and plan["total_distance_km"] > 0 and plan["a_star_searches"] > 0
    tp = plan["truck_plans"][0]
    assert tp["route_lnglat"] and tp["depart_clock"] and tp["stops_detail"][0]["eta_clock"]
    etas = [s["eta_hours"] for s in tp["stops_detail"]]
    assert etas == sorted(etas)
    pdf = client.get(f"/api/reports/pdf/{plan['plan_id']}")
    assert pdf.status_code == 200 and pdf.headers["content-type"] == "application/pdf" and len(pdf.content) > 1500
    latest = client.get("/api/plan/latest").json()
    assert latest["id"] == plan["plan_id"] and latest["truck_plans"]


def test_astar_explain(client):
    w = client.get("/api/warehouses").json()[0]["id"]
    a = client.get("/api/affected-areas").json()[0]["id"]
    d = client.post("/api/visualize/astar", json={"start_id": w, "goal_id": a}).json()
    assert d["found"] and d["trace"] and d["path_lnglat"] and d["nodes_explored_count"] > 0


def test_manual_block_changes_route(client):
    w = client.get("/api/warehouses").json()[0]["id"]
    a = client.get("/api/affected-areas").json()[0]
    base = client.post("/api/visualize/astar", json={"start_id": w, "goal_id": a["id"]}).json()
    pl = base["path_lnglat"]
    k = len(pl) // 2
    mid = [(pl[k][0] + pl[k + 1][0]) / 2, (pl[k][1] + pl[k + 1][1]) / 2]   # middle of one road segment
    e = client.get(f"/api/network/nearest-edge?lat={mid[1]}&lng={mid[0]}").json()
    assert e["found"]
    assert client.post(f"/api/network/edges/{e['id']}/block").status_code == 200
    after = client.post("/api/visualize/astar", json={"start_id": w, "goal_id": a["id"]}).json()
    assert after["path_lnglat"] != base["path_lnglat"] or not after["found"]
    assert client.post(f"/api/network/edges/{e['id']}/unblock").status_code == 200


def test_crud_roundtrip(client):
    r = client.post("/api/affected-areas", json={"name": "Test locality", "latitude": 13.05, "longitude": 80.2,
                                                  "people_affected": 500, "severity": "High"})
    assert r.status_code == 201
    aid = r.json()["id"]
    assert client.put(f"/api/affected-areas/{aid}", json={"people_affected": 900}).json()["people_affected"] == 900
    assert client.delete(f"/api/affected-areas/{aid}").status_code == 200
