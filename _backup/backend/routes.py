"""
FastAPI Route Handlers for Disaster Relief Resource Distribution Planner.
"""

from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Response
from fastapi.responses import Response as FastAPIResponse
from sqlalchemy.orm import Session

from .database import get_db
from . import models, schemas, services
from .scenarios import SCENARIOS
from .report_generator import generate_pdf_report
from .algorithms.astar import astar_search

router = APIRouter()


# ----------------------------------------------------
# SYSTEM & DASHBOARD
# ----------------------------------------------------
@router.get("/health", tags=["System"])
def health_check():
    return {
        "status": "healthy",
        "system": "Disaster Relief Resource Distribution Planner",
        "ai_engine": "Pure Classical AI (A* Search + Genetic Algorithm)",
        "ml_free": True,
    }


@router.get("/dashboard/stats", response_model=schemas.DashboardStats, tags=["Dashboard"])
def get_dashboard_stats(db: Session = Depends(get_db)):
    return services.get_dashboard_statistics(db)


# ----------------------------------------------------
# SCENARIOS
# ----------------------------------------------------
@router.get("/scenarios", tags=["Scenarios"])
def get_scenarios():
    return [
        {
            "key": k,
            "name": v["name"],
            "description": v["description"],
            "warehouses_count": len(v["warehouses"]),
            "affected_areas_count": len(v["affected_areas"]),
            "roads_count": len(v["roads"]),
            "trucks_count": len(v["trucks"]),
        }
        for k, v in SCENARIOS.items()
    ]


@router.post("/scenarios/load/{scenario_key}", tags=["Scenarios"])
def load_scenario(scenario_key: str, db: Session = Depends(get_db)):
    if scenario_key not in SCENARIOS:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Scenario '{scenario_key}' not found. Available: {list(SCENARIOS.keys())}",
        )
    return services.load_scenario_into_db(db, scenario_key)


# ----------------------------------------------------
# WAREHOUSES CRUD
# ----------------------------------------------------
@router.get("/warehouses", response_model=List[schemas.WarehouseResponse], tags=["Warehouses"])
def list_warehouses(db: Session = Depends(get_db)):
    items = db.query(models.Warehouse).all()
    return [schemas.WarehouseResponse(**w.to_dict()) for w in items]


@router.post("/warehouses", response_model=schemas.WarehouseResponse, status_code=status.HTTP_201_CREATED, tags=["Warehouses"])
def create_warehouse(warehouse: schemas.WarehouseCreate, db: Session = Depends(get_db)):
    model = models.Warehouse(**warehouse.model_dump())
    db.add(model)
    db.commit()
    db.refresh(model)
    return schemas.WarehouseResponse(**model.to_dict())


@router.get("/warehouses/{warehouse_id}", response_model=schemas.WarehouseResponse, tags=["Warehouses"])
def get_warehouse(warehouse_id: str, db: Session = Depends(get_db)):
    model = db.query(models.Warehouse).filter(models.Warehouse.id == warehouse_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Warehouse not found")
    return schemas.WarehouseResponse(**model.to_dict())


@router.put("/warehouses/{warehouse_id}", response_model=schemas.WarehouseResponse, tags=["Warehouses"])
def update_warehouse(warehouse_id: str, payload: schemas.WarehouseUpdate, db: Session = Depends(get_db)):
    model = db.query(models.Warehouse).filter(models.Warehouse.id == warehouse_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Warehouse not found")
    
    update_data = payload.model_dump(exclude_unset=True)
    for k, v in update_data.items():
        setattr(model, k, v)
    db.commit()
    db.refresh(model)
    return schemas.WarehouseResponse(**model.to_dict())


@router.delete("/warehouses/{warehouse_id}", tags=["Warehouses"])
def delete_warehouse(warehouse_id: str, db: Session = Depends(get_db)):
    model = db.query(models.Warehouse).filter(models.Warehouse.id == warehouse_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Warehouse not found")
    # Delete connected roads
    db.query(models.Road).filter(
        (models.Road.source_id == warehouse_id) | (models.Road.destination_id == warehouse_id)
    ).delete(synchronize_session=False)
    db.delete(model)
    db.commit()
    return {"message": f"Warehouse {warehouse_id} deleted successfully"}


# ----------------------------------------------------
# AFFECTED AREAS CRUD
# ----------------------------------------------------
@router.get("/affected-areas", response_model=List[schemas.AffectedAreaResponse], tags=["Affected Areas"])
def list_affected_areas(db: Session = Depends(get_db)):
    items = db.query(models.AffectedArea).all()
    return [schemas.AffectedAreaResponse(**a.to_dict()) for a in items]


@router.post("/affected-areas", response_model=schemas.AffectedAreaResponse, status_code=status.HTTP_201_CREATED, tags=["Affected Areas"])
def create_affected_area(area: schemas.AffectedAreaCreate, db: Session = Depends(get_db)):
    model = models.AffectedArea(**area.model_dump())
    db.add(model)
    db.commit()
    db.refresh(model)
    return schemas.AffectedAreaResponse(**model.to_dict())


@router.get("/affected-areas/{area_id}", response_model=schemas.AffectedAreaResponse, tags=["Affected Areas"])
def get_affected_area(area_id: str, db: Session = Depends(get_db)):
    model = db.query(models.AffectedArea).filter(models.AffectedArea.id == area_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Affected area not found")
    return schemas.AffectedAreaResponse(**model.to_dict())


@router.put("/affected-areas/{area_id}", response_model=schemas.AffectedAreaResponse, tags=["Affected Areas"])
def update_affected_area(area_id: str, payload: schemas.AffectedAreaUpdate, db: Session = Depends(get_db)):
    model = db.query(models.AffectedArea).filter(models.AffectedArea.id == area_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Affected area not found")
    
    update_data = payload.model_dump(exclude_unset=True)
    for k, v in update_data.items():
        setattr(model, k, v)
    db.commit()
    db.refresh(model)
    return schemas.AffectedAreaResponse(**model.to_dict())


@router.delete("/affected-areas/{area_id}", tags=["Affected Areas"])
def delete_affected_area(area_id: str, db: Session = Depends(get_db)):
    model = db.query(models.AffectedArea).filter(models.AffectedArea.id == area_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Affected area not found")
    # Delete connected roads
    db.query(models.Road).filter(
        (models.Road.source_id == area_id) | (models.Road.destination_id == area_id)
    ).delete(synchronize_session=False)
    db.delete(model)
    db.commit()
    return {"message": f"Affected area {area_id} deleted successfully"}


# ----------------------------------------------------
# ROAD NETWORK CRUD
# ----------------------------------------------------
@router.get("/roads", response_model=List[schemas.RoadResponse], tags=["Road Network"])
def list_roads(db: Session = Depends(get_db)):
    items = db.query(models.Road).all()
    return [schemas.RoadResponse(**r.to_dict()) for r in items]


@router.post("/roads", response_model=schemas.RoadResponse, status_code=status.HTTP_201_CREATED, tags=["Road Network"])
def create_road(road: schemas.RoadCreate, db: Session = Depends(get_db)):
    travel_time = road.travel_time
    if travel_time is None:
        travel_time = round(road.distance / 50.0, 2)
    
    model = models.Road(
        source_id=road.source_id,
        destination_id=road.destination_id,
        distance=road.distance,
        travel_time=travel_time,
        road_condition=road.road_condition,
        road_status=road.road_status,
        one_way=road.one_way,
    )
    db.add(model)
    db.commit()
    db.refresh(model)
    return schemas.RoadResponse(**model.to_dict())


@router.put("/roads/{road_id}", response_model=schemas.RoadResponse, tags=["Road Network"])
def update_road(road_id: str, payload: schemas.RoadUpdate, db: Session = Depends(get_db)):
    model = db.query(models.Road).filter(models.Road.id == road_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Road not found")
    
    update_data = payload.model_dump(exclude_unset=True)
    for k, v in update_data.items():
        setattr(model, k, v)
    db.commit()
    db.refresh(model)
    return schemas.RoadResponse(**model.to_dict())


@router.delete("/roads/{road_id}", tags=["Road Network"])
def delete_road(road_id: str, db: Session = Depends(get_db)):
    model = db.query(models.Road).filter(models.Road.id == road_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Road not found")
    db.delete(model)
    db.commit()
    return {"message": f"Road {road_id} deleted successfully"}


# ----------------------------------------------------
# TRUCKS CRUD
# ----------------------------------------------------
@router.get("/trucks", response_model=List[schemas.TruckResponse], tags=["Fleet Management"])
def list_trucks(db: Session = Depends(get_db)):
    items = db.query(models.Truck).all()
    return [schemas.TruckResponse(**t.to_dict()) for t in items]


@router.post("/trucks", response_model=schemas.TruckResponse, status_code=status.HTTP_201_CREATED, tags=["Fleet Management"])
def create_truck(truck: schemas.TruckCreate, db: Session = Depends(get_db)):
    model = models.Truck(**truck.model_dump())
    db.add(model)
    db.commit()
    db.refresh(model)
    return schemas.TruckResponse(**model.to_dict())


@router.put("/trucks/{truck_id}", response_model=schemas.TruckResponse, tags=["Fleet Management"])
def update_truck(truck_id: str, payload: schemas.TruckUpdate, db: Session = Depends(get_db)):
    model = db.query(models.Truck).filter(models.Truck.id == truck_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Truck not found")
    
    update_data = payload.model_dump(exclude_unset=True)
    for k, v in update_data.items():
        setattr(model, k, v)
    db.commit()
    db.refresh(model)
    return schemas.TruckResponse(**model.to_dict())


@router.delete("/trucks/{truck_id}", tags=["Fleet Management"])
def delete_truck(truck_id: str, db: Session = Depends(get_db)):
    model = db.query(models.Truck).filter(models.Truck.id == truck_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Truck not found")
    db.delete(model)
    db.commit()
    return {"message": f"Truck {truck_id} deleted successfully"}


# ----------------------------------------------------
# RESOURCE DISTRIBUTION PLANNER (A* + GA)
# ----------------------------------------------------
@router.post("/plan/generate", response_model=schemas.DistributionPlanResponse, tags=["Resource Planner"])
def generate_plan(request: schemas.PlanGenerationRequest, db: Session = Depends(get_db)):
    try:
        return services.generate_distribution_plan(db, request)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Distribution planning optimization failed: {str(e)}",
        )


@router.get("/plan/latest", tags=["Resource Planner"])
def get_latest_plan(db: Session = Depends(get_db)):
    model = db.query(models.DistributionPlan).order_by(models.DistributionPlan.created_at.desc()).first()
    if not model:
        raise HTTPException(status_code=404, detail="No distribution plans generated yet.")
    return model.to_dict()


# ----------------------------------------------------
# ALGORITHM VISUALIZATION ENDPOINTS
# ----------------------------------------------------
@router.post("/visualize/astar", response_model=schemas.AStarVisualizerResponse, tags=["AI Visualizer"])
def visualize_astar(request: schemas.AStarVisualizerRequest, db: Session = Depends(get_db)):
    return services.run_astar_trace(db, request)


# ----------------------------------------------------
# PDF REPORT EXPORT
# ----------------------------------------------------
@router.get("/reports/pdf/{plan_id}", tags=["Reports"])
def export_plan_pdf(plan_id: str, db: Session = Depends(get_db)):
    model = db.query(models.DistributionPlan).filter(models.DistributionPlan.id == plan_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Distribution plan not found")
    
    plan_dict = model.to_dict()
    plan_details = plan_dict.get("details", {})
    plan_details["scenario_name"] = model.name
    plan_details["total_distance_km"] = model.total_distance_km
    plan_details["total_fuel_liters"] = model.total_fuel_liters
    plan_details["total_travel_time_hours"] = model.total_travel_time_hours
    plan_details["overall_efficiency_pct"] = model.overall_efficiency_pct
    plan_details["coverage_pct"] = model.coverage_pct
    plan_details["total_resources_delivered"] = model.total_resources_delivered

    pdf_bytes = generate_pdf_report(plan_details)

    return FastAPIResponse(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=Disaster_Relief_Plan_{plan_id}.pdf"
        },
    )


@router.get("/reports/pdf/latest/download", tags=["Reports"])
def export_latest_plan_pdf(db: Session = Depends(get_db)):
    model = db.query(models.DistributionPlan).order_by(models.DistributionPlan.created_at.desc()).first()
    if not model:
        raise HTTPException(status_code=404, detail="No distribution plan available to export")
    
    plan_dict = model.to_dict()
    plan_details = plan_dict.get("details", {})
    plan_details["scenario_name"] = model.name
    plan_details["total_distance_km"] = model.total_distance_km
    plan_details["total_fuel_liters"] = model.total_fuel_liters
    plan_details["total_travel_time_hours"] = model.total_travel_time_hours
    plan_details["overall_efficiency_pct"] = model.overall_efficiency_pct
    plan_details["coverage_pct"] = model.coverage_pct
    plan_details["total_resources_delivered"] = model.total_resources_delivered

    pdf_bytes = generate_pdf_report(plan_details)

    return FastAPIResponse(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=Disaster_Relief_Action_Plan.pdf"
        },
    )
