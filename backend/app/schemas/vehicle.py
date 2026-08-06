from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import Field

from app.models.enums import FuelType
from app.schemas.base import SchemaBase


class VehicleCreate(SchemaBase):
    model_id: UUID
    nickname: str | None = Field(default=None, min_length=1, max_length=120)
    plate_number: str | None = Field(default=None, min_length=1, max_length=32)
    fuel_type: FuelType = FuelType.other
    tank_capacity_liters: float | None = Field(default=None, gt=0)
    mileage_baseline_km_per_l: float | None = Field(default=None, gt=0)


class VehicleUpdate(SchemaBase):
    model_id: UUID | None = None
    nickname: str | None = Field(default=None, min_length=1, max_length=120)
    plate_number: str | None = Field(default=None, min_length=1, max_length=32)
    fuel_type: FuelType | None = None
    tank_capacity_liters: float | None = Field(default=None, gt=0)
    mileage_baseline_km_per_l: float | None = Field(default=None, gt=0)


class VehicleRead(SchemaBase):
    id: UUID
    user_id: UUID
    model_id: UUID
    company_name: str
    model_name: str
    image_url: str | None
    nickname: str | None
    display_name: str
    plate_number: str | None
    fuel_type: FuelType
    tank_capacity_liters: float | None
    mileage_baseline_km_per_l: float | None
    created_at: datetime
