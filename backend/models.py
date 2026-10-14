"""SQLAlchemy ORM models for the Chennai Disaster Relief Planner."""

import json
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, Integer, DateTime, Boolean, Text
from .database import Base


def generate_uuid():
    return str(uuid.uuid4())[:8]


def _iso(dt):
    return dt.isoformat() if dt else None


class Warehouse(Base):
    __tablename__ = "warehouses"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(120), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    zone_id = Column(String(20), nullable=True)
    scale = Column(String(2), default="M", nullable=False)
    active = Column(Boolean, default=True, nullable=False)
    food_stock = Column(Integer, default=5000, nullable=False)
    water_stock = Column(Integer, default=5000, nullable=False)
    medicine_stock = Column(Integer, default=2000, nullable=False)
    blanket_stock = Column(Integer, default=3000, nullable=False)
    emergency_kit_stock = Column(Integer, default=1500, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id, "name": self.name, "latitude": self.latitude, "longitude": self.longitude,
            "lat": self.latitude, "lng": self.longitude, "zone_id": self.zone_id, "scale": self.scale,
            "active": self.active,
            "food_stock": self.food_stock, "water_stock": self.water_stock, "medicine_stock": self.medicine_stock,
            "blanket_stock": self.blanket_stock, "emergency_kit_stock": self.emergency_kit_stock,
            "stocks": {"food": self.food_stock, "water": self.water_stock, "medicine": self.medicine_stock,
                       "blankets": self.blanket_stock, "emergency_kits": self.emergency_kit_stock},
            "created_at": _iso(self.created_at), "updated_at": _iso(self.updated_at),
        }


class AffectedArea(Base):
    __tablename__ = "affected_areas"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(120), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    zone_id = Column(String(20), nullable=True)
    hotspot_id = Column(String(30), nullable=True)
    hazard = Column(String(20), default="flood", nullable=False)       # flood | wind | earthquake | manual
    risk_score = Column(Float, default=0.0, nullable=False)
    people_affected = Column(Integer, default=0, nullable=False)
    reason = Column(Text, default="", nullable=False)
    manual = Column(Boolean, default=False, nullable=False)           # entered by an operator (kept on re-sync)
    population = Column(Integer, default=1000, nullable=False)
    severity = Column(String(20), default="Medium", nullable=False)  # Low, Medium, High, Critical
    food_demand = Column(Integer, default=500, nullable=False)
    water_demand = Column(Integer, default=1000, nullable=False)
    medicine_demand = Column(Integer, default=200, nullable=False)
    blanket_demand = Column(Integer, default=300, nullable=False)
    emergency_kit_demand = Column(Integer, default=150, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id, "name": self.name, "latitude": self.latitude, "longitude": self.longitude,
            "lat": self.latitude, "lng": self.longitude, "zone_id": self.zone_id, "hotspot_id": self.hotspot_id,
            "hazard": self.hazard, "risk_score": self.risk_score, "people_affected": self.people_affected,
            "reason": self.reason, "manual": self.manual, "population": self.population, "severity": self.severity,
            "food_demand": self.food_demand, "water_demand": self.water_demand, "medicine_demand": self.medicine_demand,
            "blanket_demand": self.blanket_demand, "emergency_kit_demand": self.emergency_kit_demand,
            "demands": {"food": self.food_demand, "water": self.water_demand, "medicine": self.medicine_demand,
                        "blankets": self.blanket_demand, "emergency_kits": self.emergency_kit_demand},
            "created_at": _iso(self.created_at), "updated_at": _iso(self.updated_at),
        }


class RoadBlock(Base):
    """Operator-set road closure (edge index in the current road network)."""
    __tablename__ = "road_blocks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    edge_index = Column(Integer, nullable=False)
    network_signature = Column(String(60), nullable=False)
    name = Column(String(160), default="", nullable=False)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    reason = Column(String(200), default="Blocked by operator")
    created_at = Column(DateTime, default=datetime.utcnow)


class Truck(Base):
    __tablename__ = "trucks"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    truck_number = Column(String(50), nullable=False, unique=True)
    truck_type = Column(String(40), default="Light truck (4 t)", nullable=False)
    capacity = Column(Float, default=2000.0, nullable=False)       # relief units
    fuel_capacity = Column(Float, default=250.0, nullable=False)   # litres
    average_speed = Column(Float, default=36.0, nullable=False)    # km/h reference speed
    fuel_consumption = Column(Float, default=0.28, nullable=False) # L/km
    current_warehouse_id = Column(String(36), nullable=False)
    status = Column(String(30), default="Available", nullable=False)  # Available, Busy, In Maintenance
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id, "truck_number": self.truck_number, "truck_type": self.truck_type,
            "capacity": self.capacity, "fuel_capacity": self.fuel_capacity, "average_speed": self.average_speed,
            "fuel_consumption": self.fuel_consumption, "current_warehouse_id": self.current_warehouse_id,
            "warehouse_id": self.current_warehouse_id, "status": self.status,
            "created_at": _iso(self.created_at), "updated_at": _iso(self.updated_at),
        }


class DistributionPlan(Base):
    __tablename__ = "distribution_plans"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(150), default="Distribution Plan", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    total_distance_km = Column(Float, default=0.0)
    total_fuel_liters = Column(Float, default=0.0)
    total_travel_time_hours = Column(Float, default=0.0)
    overall_efficiency_pct = Column(Float, default=0.0)
    coverage_pct = Column(Float, default=0.0)
    total_resources_delivered = Column(Integer, default=0)
    plan_data_json = Column(Text, nullable=False)

    def to_dict(self):
        return {
            "id": self.id, "name": self.name, "created_at": _iso(self.created_at),
            "total_distance_km": self.total_distance_km, "total_fuel_liters": self.total_fuel_liters,
            "total_travel_time_hours": self.total_travel_time_hours,
            "overall_efficiency_pct": self.overall_efficiency_pct, "coverage_pct": self.coverage_pct,
            "total_resources_delivered": self.total_resources_delivered,
            "details": json.loads(self.plan_data_json) if self.plan_data_json else {},
        }


class AppState(Base):
    __tablename__ = "app_state"

    key = Column(String(40), primary_key=True)
    value = Column(Text, default="")
