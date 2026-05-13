from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import Field

from app.models.enums import FuelType
from app.schemas.base import SchemaBase


class VehicleCreate(SchemaBase):
    name: str = Field(min_length=1, max_length=120)
    plate_number: str | None = Field(default=None, min_length=1, max_length=32)
    fuel_type: FuelType = FuelType.other
    tank_capacity_liters: float | None = Field(default=None, gt=0)
    mileage_baseline_km_per_l: float | None = Field(default=None, gt=0)


class VehicleUpdate(SchemaBase):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    plate_number: str | None = Field(default=None, min_length=1, max_length=32)
    fuel_type: FuelType | None = None
    tank_capacity_liters: float | None = Field(default=None, gt=0)
    mileage_baseline_km_per_l: float | None = Field(default=None, gt=0)


class VehicleRead(SchemaBase):
    id: UUID
    user_id: UUID
    name: str
    plate_number: str | None
    fuel_type: FuelType
    tank_capacity_liters: float | None
    mileage_baseline_km_per_l: float | None
    created_at: datetime
