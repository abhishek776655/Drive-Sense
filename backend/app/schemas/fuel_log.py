from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import Field

from app.schemas.base import SchemaBase


class FuelLogCreate(SchemaBase):
    vehicle_id: UUID
    liters: float = Field(gt=0)
    cost_amount: float | None = Field(default=None, ge=0)
    cost_currency: str | None = Field(default=None, min_length=3, max_length=3)
    odometer_km: float | None = Field(default=None, ge=0)
    filled_at: datetime


class FuelLogRead(SchemaBase):
    id: UUID
    vehicle_id: UUID
    liters: float
    filled_at: datetime

