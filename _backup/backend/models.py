"""
SQLAlchemy ORM Models for Disaster Relief Resource Distribution Planner.
"""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, Integer, DateTime, Boolean, Text, ForeignKey
from .database import Base


def generate_uuid():
    return str(uuid.uuid4())[:8]


class Warehouse(Base):
    __tablename__ = "warehouses"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(100), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    food_stock = Column(Integer, default=5000, nullable=False)
    water_stock = Column(Integer, default=5000, nullable=False)
    medicine_stock = Column(Integer, default=2000, nullable=False)
    blanket_stock = Column(Integer, default=3000, nullable=False)
    emergency_kit_stock = Column(Integer, default=1500, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "lat": self.latitude,
            "lng": self.longitude,
            "food_stock": self.food_stock,
            "water_stock": self.water_stock,
            "medicine_stock": self.medicine_stock,
            "blanket_stock": self.blanket_stock,
            "emergency_kit_stock": self.emergency_kit_stock,
            "stocks": {
                "food": self.food_stock,
                "water": self.water_stock,
                "medicine": self.medicine_stock,
                "blankets": self.blanket_stock,
                "emergency_kits": self.emergency_kit_stock,
            },
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class AffectedArea(Base):
    __tablename__ = "affected_areas"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(100), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
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
            "id": self.id,
            "name": self.name,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "lat": self.latitude,
            "lng": self.longitude,
            "population": self.population,
            "severity": self.severity,
            "food_demand": self.food_demand,
            "water_demand": self.water_demand,
            "medicine_demand": self.medicine_demand,
            "blanket_demand": self.blanket_demand,
            "emergency_kit_demand": self.emergency_kit_demand,
            "demands": {
                "food": self.food_demand,
                "water": self.water_demand,
                "medicine": self.medicine_demand,
                "blankets": self.blanket_demand,
                "emergency_kits": self.emergency_kit_demand,
            },
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class Road(Base):
    __tablename__ = "roads"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    source_id = Column(String(36), nullable=False)
    destination_id = Column(String(36), nullable=False)
    distance = Column(Float, nullable=False)  # in km
    travel_time = Column(Float, nullable=False)  # in hours
    road_condition = Column(String(30), default="Paved", nullable=False)  # Paved, Unpaved, Damaged
    road_status = Column(String(30), default="Open", nullable=False)  # Open, Blocked, Under Repair
    one_way = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "source_id": self.source_id,
            "destination_id": self.destination_id,
            "distance": self.distance,
            "travel_time": self.travel_time,
            "road_condition": self.road_condition,
            "road_status": self.road_status,
            "condition": self.road_condition,
            "status": self.road_status,
            "one_way": self.one_way,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class Truck(Base):
    __tablename__ = "trucks"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    truck_number = Column(String(50), nullable=False, unique=True)
    capacity = Column(Float, default=2000.0, nullable=False)  # total units/kg capacity
    fuel_capacity = Column(Float, default=250.0, nullable=False)  # in liters
    average_speed = Column(Float, default=55.0, nullable=False)  # km/h
    fuel_consumption = Column(Float, default=0.28, nullable=False)  # L/km
    current_warehouse_id = Column(String(36), nullable=False)
    status = Column(String(30), default="Available", nullable=False)  # Available, Busy, In Maintenance
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "truck_number": self.truck_number,
            "capacity": self.capacity,
            "fuel_capacity": self.fuel_capacity,
            "average_speed": self.average_speed,
            "fuel_consumption": self.fuel_consumption,
            "current_warehouse_id": self.current_warehouse_id,
            "warehouse_id": self.current_warehouse_id,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
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
    plan_data_json = Column(Text, nullable=False)  # Serialized plan JSON

    def to_dict(self):
        import json
        return {
            "id": self.id,
            "name": self.name,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "total_distance_km": self.total_distance_km,
            "total_fuel_liters": self.total_fuel_liters,
            "total_travel_time_hours": self.total_travel_time_hours,
            "overall_efficiency_pct": self.overall_efficiency_pct,
            "coverage_pct": self.coverage_pct,
            "total_resources_delivered": self.total_resources_delivered,
            "details": json.loads(self.plan_data_json) if self.plan_data_json else {},
        }
