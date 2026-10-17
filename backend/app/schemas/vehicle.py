from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import Field, model_validator

from app.models.enums import FuelType
from app.schemas.base import SchemaBase

VehicleType = Literal["car", "motorbike"]


class VehicleCreate(SchemaBase):
    # Either a catalog model, or a typed make and model that the service finds or creates.
    model_id: UUID | None = None
    make: str | None = Field(default=None, min_length=1, max_length=80)
    model: str | None = Field(default=None, min_length=1, max_length=80)
    nickname: str | None = Field(default=None, min_length=1, max_length=120)
    plate_number: str | None = Field(default=None, min_length=1, max_length=32)
    fuel_type: FuelType = FuelType.other
    tank_capacity_liters: float | None = Field(default=None, gt=0)
    mileage_baseline_km_per_l: float | None = Field(default=None, gt=0)
    vehicle_type: VehicleType = "car"
    year: int | None = Field(default=None, ge=1900, le=2100)
    horsepower: int | None = Field(default=None, gt=0, le=5000)

    @model_validator(mode="after")
    def _needs_a_model(self) -> "VehicleCreate":
        if self.model_id is None and not (self.make and self.model):
            raise ValueError("Give model_id, or both make and model")
        return self


class VehicleUpdate(SchemaBase):
    model_id: UUID | None = None
    make: str | None = Field(default=None, min_length=1, max_length=80)
    model: str | None = Field(default=None, min_length=1, max_length=80)
    nickname: str | None = Field(default=None, min_length=1, max_length=120)
    plate_number: str | None = Field(default=None, min_length=1, max_length=32)
    fuel_type: FuelType | None = None
    tank_capacity_liters: float | None = Field(default=None, gt=0)
    mileage_baseline_km_per_l: float | None = Field(default=None, gt=0)
    vehicle_type: VehicleType | None = None
    year: int | None = Field(default=None, ge=1900, le=2100)
    horsepower: int | None = Field(default=None, gt=0, le=5000)

    @model_validator(mode="after")
    def _make_and_model_together(self) -> "VehicleUpdate":
        if (self.make is None) != (self.model is None):
            raise ValueError("Give make and model together")
        return self


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
    vehicle_type: VehicleType
    year: int | None
    horsepower: int | None
    photo_url: str | None
    created_at: datetime


class VehiclePhotoUpload(SchemaBase):
    # Base64 JPEG or PNG; the app resizes to about 1000 px first, so this stays well under the cap.
    data: str = Field(min_length=1, max_length=4_000_000)
