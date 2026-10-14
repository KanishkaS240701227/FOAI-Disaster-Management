"""
Pydantic schemas for data validation and API serialization.
"""

from typing import Dict, List, Optional, Any, Tuple
from pydantic import BaseModel, Field, ConfigDict


# Resource counts
class ResourceBundle(BaseModel):
    food: int = Field(default=0, ge=0)
    water: int = Field(default=0, ge=0)
    medicine: int = Field(default=0, ge=0)
    blankets: int = Field(default=0, ge=0)
    emergency_kits: int = Field(default=0, ge=0)


# Warehouse Schemas
class WarehouseBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)
    food_stock: int = Field(default=5000, ge=0)
    water_stock: int = Field(default=5000, ge=0)
    medicine_stock: int = Field(default=2000, ge=0)
    blanket_stock: int = Field(default=3000, ge=0)
    emergency_kit_stock: int = Field(default=1500, ge=0)


class WarehouseCreate(WarehouseBase):
    pass


class WarehouseUpdate(BaseModel):
    name: Optional[str] = None
    latitude: Optional[float] = Field(default=None, ge=-90.0, le=90.0)
    longitude: Optional[float] = Field(default=None, ge=-180.0, le=180.0)
    food_stock: Optional[int] = Field(default=None, ge=0)
    water_stock: Optional[int] = Field(default=None, ge=0)
    medicine_stock: Optional[int] = Field(default=None, ge=0)
    blanket_stock: Optional[int] = Field(default=None, ge=0)
    emergency_kit_stock: Optional[int] = Field(default=None, ge=0)


class WarehouseResponse(WarehouseBase):
    id: str
    lat: float
    lng: float
    stocks: ResourceBundle
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# Affected Area Schemas
class AffectedAreaBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)
    population: int = Field(default=1000, ge=1)
    severity: str = Field(default="Medium", pattern="^(Low|Medium|High|Critical)$")
    food_demand: int = Field(default=500, ge=0)
    water_demand: int = Field(default=1000, ge=0)
    medicine_demand: int = Field(default=200, ge=0)
    blanket_demand: int = Field(default=300, ge=0)
    emergency_kit_demand: int = Field(default=150, ge=0)


class AffectedAreaCreate(AffectedAreaBase):
    pass


class AffectedAreaUpdate(BaseModel):
    name: Optional[str] = None
    latitude: Optional[float] = Field(default=None, ge=-90.0, le=90.0)
    longitude: Optional[float] = Field(default=None, ge=-180.0, le=180.0)
    population: Optional[int] = Field(default=None, ge=1)
    severity: Optional[str] = Field(default=None, pattern="^(Low|Medium|High|Critical)$")
    food_demand: Optional[int] = Field(default=None, ge=0)
    water_demand: Optional[int] = Field(default=None, ge=0)
    medicine_demand: Optional[int] = Field(default=None, ge=0)
    blanket_demand: Optional[int] = Field(default=None, ge=0)
    emergency_kit_demand: Optional[int] = Field(default=None, ge=0)


class AffectedAreaResponse(AffectedAreaBase):
    id: str
    lat: float
    lng: float
    demands: ResourceBundle
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# Road Schemas
class RoadBase(BaseModel):
    source_id: str
    destination_id: str
    distance: float = Field(..., gt=0.0)
    travel_time: Optional[float] = Field(default=None, gt=0.0)
    road_condition: str = Field(default="Paved", pattern="^(Paved|Unpaved|Damaged)$")
    road_status: str = Field(default="Open", pattern="^(Open|Blocked|Under Repair)$")
    one_way: bool = Field(default=False)


class RoadCreate(RoadBase):
    pass


class RoadUpdate(BaseModel):
    source_id: Optional[str] = None
    destination_id: Optional[str] = None
    distance: Optional[float] = Field(default=None, gt=0.0)
    travel_time: Optional[float] = Field(default=None, gt=0.0)
    road_condition: Optional[str] = Field(default=None, pattern="^(Paved|Unpaved|Damaged)$")
    road_status: Optional[str] = Field(default=None, pattern="^(Open|Blocked|Under Repair)$")
    one_way: Optional[bool] = None


class RoadResponse(RoadBase):
    id: str
    condition: str
    status: str
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# Truck Schemas
class TruckBase(BaseModel):
    truck_number: str = Field(..., min_length=2, max_length=50)
    capacity: float = Field(default=2000.0, gt=0.0)
    fuel_capacity: float = Field(default=250.0, gt=0.0)
    average_speed: float = Field(default=55.0, gt=0.0)
    fuel_consumption: float = Field(default=0.28, gt=0.0)
    current_warehouse_id: str
    status: str = Field(default="Available", pattern="^(Available|Busy|In Maintenance)$")


class TruckCreate(TruckBase):
    pass


class TruckUpdate(BaseModel):
    truck_number: Optional[str] = None
    capacity: Optional[float] = Field(default=None, gt=0.0)
    fuel_capacity: Optional[float] = Field(default=None, gt=0.0)
    average_speed: Optional[float] = Field(default=None, gt=0.0)
    fuel_consumption: Optional[float] = Field(default=None, gt=0.0)
    current_warehouse_id: Optional[str] = None
    status: Optional[str] = Field(default=None, pattern="^(Available|Busy|In Maintenance)$")


class TruckResponse(TruckBase):
    id: str
    warehouse_id: str
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# Planner Request & Execution Schemas
class PlanGenerationRequest(BaseModel):
    population_size: int = Field(default=100, ge=20, le=300)
    generations: int = Field(default=300, ge=10, le=1000)
    mutation_rate: float = Field(default=0.05, ge=0.01, le=0.5)
    crossover_rate: float = Field(default=0.80, ge=0.1, le=1.0)
    scenario_name: Optional[str] = "Live Disaster Deployment"


class StopAllocation(BaseModel):
    location_id: str
    location_name: str
    severity: str
    delivered: ResourceBundle
    unmet: ResourceBundle


class TruckPlanOutput(BaseModel):
    truck_id: str
    truck_number: str
    warehouse_id: str
    warehouse_name: str
    assigned_locations: List[str]
    assigned_location_names: List[str]
    optimal_route_sequence: List[str]
    optimal_route_coordinates: List[List[float]]
    distance_km: float
    estimated_time_hours: float
    fuel_usage_liters: float
    total_load_units: float
    capacity_limit: float
    capacity_utilization_pct: float
    fuel_capacity_limit: float
    overload_units: float
    fuel_overuse_liters: float
    resources_delivered: ResourceBundle
    priority_level: str
    stops_detail: List[StopAllocation]


class DashboardStats(BaseModel):
    total_warehouses: int
    total_affected_locations: int
    available_trucks: int
    busy_trucks: int
    total_trucks: int
    pending_requests_count: int
    total_resources_stock: ResourceBundle
    total_resources_demand: ResourceBundle
    total_travel_distance_km: float
    estimated_fuel_usage_liters: float
    overall_delivery_efficiency_pct: float
    coverage_percentage: float


class DistributionPlanResponse(BaseModel):
    plan_id: str
    scenario_name: str
    created_at: str
    total_distance_km: float
    total_fuel_liters: float
    total_travel_time_hours: float
    overall_efficiency_pct: float
    coverage_pct: float
    total_resources_delivered: int
    total_demand_units: int
    truck_plans: List[TruckPlanOutput]
    generation_history: List[Dict[str, Any]]
    unmet_demands: Dict[str, Dict[str, int]]
    algorithm_parameters: Dict[str, Any]
    warnings: List[str]
    message: str


# A* Visualizer API
class AStarVisualizerRequest(BaseModel):
    start_id: str
    goal_id: str
    truck_speed_kmh: Optional[float] = 60.0
    truck_fuel_rate_lpkm: Optional[float] = 0.25


class AStarVisualizerResponse(BaseModel):
    found: bool
    path: List[str]
    path_names: List[str]
    path_coordinates: List[List[float]]
    total_distance_km: float
    estimated_travel_time_hours: float
    estimated_fuel_liters: float
    nodes_explored_count: int
    open_list_final_size: int
    steps_log: List[Dict[str, Any]]
    message: str


# GA Visualizer API
class GAVisualizerRequest(BaseModel):
    population_size: Optional[int] = 100
    generations: Optional[int] = 300
    mutation_rate: Optional[float] = 0.05
    crossover_rate: Optional[float] = 0.80
