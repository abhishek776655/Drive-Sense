from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import Field
from pydantic.types import AwareDatetime

from app.models.enums import TripState
from app.schemas.base import SchemaBase


class TripStartRequest(SchemaBase):
    vehicle_id: UUID
    start_time: AwareDatetime | None = None


class TripEndRequest(SchemaBase):
    vehicle_id: UUID
    end_time: AwareDatetime | None = None
    distance_meters: float | None = Field(default=None, ge=0)
    duration_seconds: int | None = Field(default=None, ge=0)


class TripRead(SchemaBase):
    id: UUID
    user_id: UUID
    vehicle_id: UUID
    state: TripState
    start_time: AwareDatetime
    end_time: AwareDatetime | None
    distance_meters: float
    duration_seconds: int
    created_at: datetime


class TripListRead(TripRead):
    vehicle_name: str
    driving_score: int | None = None
    avg_speed_mps: float | None = None
    event_count: int = 0


class TripListPage(SchemaBase):
    items: list[TripListRead] = Field(default_factory=list)
    total: int = 0
    limit: int = 0
    offset: int = 0


class TripLocationPointRead(SchemaBase):
    id: int
    trip_id: UUID
    recorded_at: AwareDatetime
    latitude: float
    longitude: float
    speed_mps: float | None = None
    heading_deg: float | None = None
    accuracy_m: float | None = None
    altitude_m: float | None = None
    is_moving: bool | None = None
    provider: str | None = None


class TripEventRead(SchemaBase):
    id: UUID
    trip_id: UUID
    event_type: str
    intensity: float | None = None
    occurred_at: AwareDatetime
    latitude: float | None = None
    longitude: float | None = None
    payload: dict = Field(default_factory=dict)


class TripDetailRead(TripRead):
    vehicle_name: str
    avg_speed_mps: float | None = None
    max_speed_mps: float | None = None
    idle_time_seconds: int
    fuel_used_liters: float | None = None
    cost_amount: float | None = None
    cost_currency: str | None = None
    driving_score: int | None = None
    location_points: list[TripLocationPointRead] = Field(default_factory=list)
    events: list[TripEventRead] = Field(default_factory=list)
