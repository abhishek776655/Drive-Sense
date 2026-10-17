from __future__ import annotations

from uuid import UUID

from pydantic import Field
from pydantic.types import AwareDatetime

from app.schemas.base import SchemaBase


class LocationPointCreate(SchemaBase):
    recorded_at: AwareDatetime
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    speed_mps: float | None = Field(default=None, ge=0)
    heading_deg: float | None = Field(default=None, ge=0, le=360)
    accuracy_m: float | None = Field(default=None, ge=0)
    altitude_m: float | None = None
    # Peak motion-sensor G since the previous fix; capped well above anything a car can do.
    peak_g: float | None = Field(default=None, ge=0, le=5)
    is_moving: bool | None = None
    provider: str | None = None


class LocationPointRead(SchemaBase):
    trip_id: UUID
    recorded_at: AwareDatetime
    id: int
    latitude: float
    longitude: float
    speed_mps: float | None


class LocationIngestResponse(SchemaBase):
    trip_id: UUID
    accepted_points: int
