"""FastAPI route handlers for the Chennai Disaster Relief Planner."""
from __future__ import annotations

import json
import threading
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response as FastAPIResponse
from sqlalchemy.orm import Session

from . import chennai_data as cd
from . import models, osm_import, runtime, schemas, services
from .algorithms.astar import astar_search  # noqa: F401  (kept for API compatibility / tests)
from .database import get_db
from .hazards import ENGINE
from .report_generator import generate_pdf_report
from .scenarios import SCENARIOS, scenario_list

router = APIRouter()


# ------------------------------------------------------------------ system
@router.get("/health", tags=["System"])
def health_check():
    return {"status": "healthy", "system": "Chennai Disaster Relief Planner",
            "ai_engine": "Pure Classical AI (A* Search + Genetic Algorithm)", "ml_free": True,
            "network": runtime.ROAD.source}


@router.get("/state", tags=["System"])
def get_state(db: Session = Depends(get_db)):
    """Everything the live map needs in one call."""
    return services.build_state(db)


@router.get("/dashboard/stats", response_model=schemas.DashboardStats, tags=["Dashboard"])
def get_dashboard_stats(db: Session = Depends(get_db)):
    return services.get_dashboard_statistics(db)


# ------------------------------------------------------------------ static geography
@router.get("/geo/meta", tags=["Geography"])
def geo_meta():
    return cd.meta()


@router.get("/geo/zones", tags=["Geography"])
def geo_zones():
    return cd.zones_geojson()


@router.get("/geo/outline", tags=["Geography"])
def geo_outline():
    return cd.outline_geojson()


@router.get("/geo/hotspots", tags=["Geography"])
def geo_hotspots():
    return cd.hotspots()


# ------------------------------------------------------------------ hazards & scenarios
@router.get("/hazards", tags=["Hazards"])
def get_hazards():
    return ENGINE.snapshot()


@router.post("/hazards/refresh", tags=["Hazards"])
def refresh_hazards(db: Session = Depends(get_db)):
    ENGINE.refresh_live()
    if services.active_scenario_key(db) == "live":
        services.sync_areas_from_hazards(db)
    else:
        runtime.apply_hazards()
    return ENGINE.snapshot()


@router.get("/scenarios", tags=["Scenarios"])
def get_scenarios(db: Session = Depends(get_db)):
    return {"active": services.active_scenario_key(db), "items": scenario_list()}


@router.post("/scenarios/load/{scenario_key}", tags=["Scenarios"])
def load_scenario(scenario_key: str, db: Session = Depends(get_db)):
    if scenario_key not in SCENARIOS:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Scenario '{scenario_key}' not found.")
    return services.load_scenario_into_db(db, scenario_key)


@router.post("/affected-areas/sync", tags=["Affected Areas"])
def sync_areas(db: Session = Depends(get_db)):
    return {"count": services.sync_areas_from_hazards(db)}


# ------------------------------------------------------------------ generic CRUD helpers
def _get_or_404(db: Session, model, item_id: str, label: str):
    obj = db.query(model).filter(model.id == item_id).first()
    if not obj:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"{label} not found")
    return obj


# ------------------------------------------------------------------ warehouses
@router.get("/warehouses", response_model=List[schemas.WarehouseResponse], tags=["Warehouses"])
def list_warehouses(db: Session = Depends(get_db)):
    return [w.to_dict() for w in db.query(models.Warehouse).all()]


@router.post("/warehouses", response_model=schemas.WarehouseResponse, status_code=201, tags=["Warehouses"])
def create_warehouse(w: schemas.WarehouseCreate, db: Session = Depends(get_db)):
    obj = models.Warehouse(**w.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj.to_dict()


@router.get("/warehouses/{wid}", response_model=schemas.WarehouseResponse, tags=["Warehouses"])
def get_warehouse(wid: str, db: Session = Depends(get_db)):
    return _get_or_404(db, models.Warehouse, wid, "Warehouse").to_dict()


@router.put("/warehouses/{wid}", response_model=schemas.WarehouseResponse, tags=["Warehouses"])
def update_warehouse(wid: str, payload: schemas.WarehouseUpdate, db: Session = Depends(get_db)):
    obj = _get_or_404(db, models.Warehouse, wid, "Warehouse")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj.to_dict()


@router.delete("/warehouses/{wid}", tags=["Warehouses"])
def delete_warehouse(wid: str, db: Session = Depends(get_db)):
    obj = _get_or_404(db, models.Warehouse, wid, "Warehouse")
    if db.query(models.Truck).filter(models.Truck.current_warehouse_id == wid).count():
        raise HTTPException(status.HTTP_409_CONFLICT, "Move or delete this depot's trucks first.")
    db.delete(obj)
    db.commit()
    return {"success": True}


# ------------------------------------------------------------------ affected areas
@router.get("/affected-areas", response_model=List[schemas.AffectedAreaResponse], tags=["Affected Areas"])
def list_areas(db: Session = Depends(get_db)):
    return [a.to_dict() for a in db.query(models.AffectedArea).all()]


@router.post("/affected-areas", response_model=schemas.AffectedAreaResponse, status_code=201, tags=["Affected Areas"])
def create_area(a: schemas.AffectedAreaCreate, db: Session = Depends(get_db)):
    data = a.model_dump()
    data["manual"] = True
    obj = models.AffectedArea(**data)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj.to_dict()


@router.get("/affected-areas/{aid}", response_model=schemas.AffectedAreaResponse, tags=["Affected Areas"])
def get_area(aid: str, db: Session = Depends(get_db)):
    return _get_or_404(db, models.AffectedArea, aid, "Affected area").to_dict()


@router.put("/affected-areas/{aid}", response_model=schemas.AffectedAreaResponse, tags=["Affected Areas"])
def update_area(aid: str, payload: schemas.AffectedAreaUpdate, db: Session = Depends(get_db)):
    obj = _get_or_404(db, models.AffectedArea, aid, "Affected area")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    obj.manual = True          # an edited area is kept when hazards re-sync
    db.commit()
    db.refresh(obj)
    return obj.to_dict()


@router.delete("/affected-areas/{aid}", tags=["Affected Areas"])
def delete_area(aid: str, db: Session = Depends(get_db)):
    db.delete(_get_or_404(db, models.AffectedArea, aid, "Affected area"))
    db.commit()
    return {"success": True}


# ------------------------------------------------------------------ trucks
@router.get("/trucks", response_model=List[schemas.TruckResponse], tags=["Fleet Management"])
def list_trucks(db: Session = Depends(get_db)):
    return [t.to_dict() for t in db.query(models.Truck).all()]


@router.post("/trucks", response_model=schemas.TruckResponse, status_code=201, tags=["Fleet Management"])
def create_truck(t: schemas.TruckCreate, db: Session = Depends(get_db)):
    if db.query(models.Truck).filter(models.Truck.truck_number == t.truck_number).first():
        raise HTTPException(status.HTTP_409_CONFLICT, "A truck with this number already exists.")
    if not db.query(models.Warehouse).filter(models.Warehouse.id == t.current_warehouse_id).first():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Unknown depot.")
    obj = models.Truck(**t.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj.to_dict()


@router.put("/trucks/{tid}", response_model=schemas.TruckResponse, tags=["Fleet Management"])
def update_truck(tid: str, payload: schemas.TruckUpdate, db: Session = Depends(get_db)):
    obj = _get_or_404(db, models.Truck, tid, "Truck")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj.to_dict()


@router.delete("/trucks/{tid}", tags=["Fleet Management"])
def delete_truck(tid: str, db: Session = Depends(get_db)):
    db.delete(_get_or_404(db, models.Truck, tid, "Truck"))
    db.commit()
    return {"success": True}


# ------------------------------------------------------------------ road network
@router.get("/network/status", tags=["Road Network"])
def network_status():
    r = runtime.ROAD
    return {"source": r.source, "nodes": len(r.nodes), "edges": len(r.edges), "state": r.state_counts(),
            "fetched_at": r.meta.get("fetched_at"), "import": osm_import.STATE,
            "osm_available": osm_import.osm_file_exists()}


@router.post("/network/download", tags=["Road Network"])
def network_download(db: Session = Depends(get_db)):
    def done():
        runtime.reload_road()
    started = osm_import.start_background_import(on_done=done)
    return {"started": started, "import": osm_import.STATE}


@router.get("/network/overlay", tags=["Road Network"])
def network_overlay():
    """GeoJSON of slowed / blocked road segments (drawn on the map)."""
    return runtime.ROAD.overlay_geojson()


@router.get("/network/nearest-edge", tags=["Road Network"])
def nearest_edge(lat: float, lng: float):
    hit = runtime.ROAD.nearest_edge(lat, lng, max_m=600.0)
    if not hit:
        return {"found": False}
    e, d = hit
    return {"found": True, "id": e.idx, "name": e.name or "Unnamed road", "cls": e.cls, "km": round(e.km, 2),
            "status": e.status, "factor": e.factor, "reason": e.reason, "manual": e.manual,
            "distance_m": round(d), "geometry": [[p[1], p[0]] for p in e.geom]}


@router.post("/network/edges/{edge_id}/block", tags=["Road Network"])
def block_road(edge_id: int, body: schemas.RoadBlockRequest = schemas.RoadBlockRequest(), db: Session = Depends(get_db)):
    try:
        return services.block_edge(db, edge_id, body.reason)
    except KeyError:
        raise HTTPException(404, "Road segment not found")


@router.post("/network/edges/{edge_id}/unblock", tags=["Road Network"])
def unblock_road(edge_id: int, db: Session = Depends(get_db)):
    try:
        return services.unblock_edge(db, edge_id)
    except KeyError:
        raise HTTPException(404, "Road segment not found")


# ------------------------------------------------------------------ planner
@router.post("/plan/generate", response_model=schemas.DistributionPlanResponse, tags=["Resource Planner"])
def generate_plan(request: schemas.PlanGenerationRequest, db: Session = Depends(get_db)):
    try:
        return services.generate_distribution_plan(db, request)
    except Exception as e:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, f"Distribution planning failed: {e}")


def _plan_payload(model: models.DistributionPlan) -> Dict[str, Any]:
    d = model.to_dict()
    det = d.pop("details")
    return {**d, **det, "plan_id": d["id"], "scenario_name": d["name"]}


@router.get("/plan/latest", tags=["Resource Planner"])
def get_latest_plan(db: Session = Depends(get_db)):
    model = db.query(models.DistributionPlan).order_by(models.DistributionPlan.created_at.desc()).first()
    if not model:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No distribution plans generated yet.")
    return _plan_payload(model)


@router.get("/plans", tags=["Resource Planner"])
def list_plans(db: Session = Depends(get_db)):
    rows = db.query(models.DistributionPlan).order_by(models.DistributionPlan.created_at.desc()).all()
    return [{"id": r.id, "name": r.name, "created_at": r.created_at.isoformat(), "coverage_pct": r.coverage_pct,
             "total_distance_km": r.total_distance_km, "total_time_hours": r.total_travel_time_hours} for r in rows]


@router.get("/plans/{plan_id}", tags=["Resource Planner"])
def get_plan(plan_id: str, db: Session = Depends(get_db)):
    return _plan_payload(_get_or_404(db, models.DistributionPlan, plan_id, "Plan"))


@router.post("/visualize/astar", response_model=schemas.AStarVisualizerResponse, tags=["AI Visualizer"])
def visualize_astar(request: schemas.AStarVisualizerRequest, db: Session = Depends(get_db)):
    return services.run_astar_trace(db, request)


# ------------------------------------------------------------------ PDF export
def _pdf_for(model: models.DistributionPlan, filename: str):
    plan = _plan_payload(model)
    plan["scenario_name"] = model.name
    pdf = generate_pdf_report(plan)
    return FastAPIResponse(content=pdf, media_type="application/pdf",
                           headers={"Content-Disposition": f'attachment; filename="{filename}"'})


@router.get("/reports/pdf/latest/download", tags=["Reports"])
def export_latest_plan_pdf(db: Session = Depends(get_db)):
    model = db.query(models.DistributionPlan).order_by(models.DistributionPlan.created_at.desc()).first()
    if not model:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No distribution plan available to export")
    return _pdf_for(model, "Chennai_Relief_Dispatch_Plan.pdf")


@router.get("/reports/pdf/{plan_id}", tags=["Reports"])
def export_plan_pdf(plan_id: str, db: Session = Depends(get_db)):
    model = _get_or_404(db, models.DistributionPlan, plan_id, "Distribution plan")
    return _pdf_for(model, f"Chennai_Relief_Dispatch_Plan_{plan_id}.pdf")
