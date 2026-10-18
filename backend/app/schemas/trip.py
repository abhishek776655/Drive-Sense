from __future__ import annotations

from typing import Literal

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


class TripFinishEvent(SchemaBase):
    event_type: Literal["harsh_brake", "rapid_acceleration", "overspeed", "sharp_turn"]
    intensity: float = Field(ge=0, le=100)
    occurred_at: AwareDatetime
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


class TripFinishRequest(SchemaBase):
    """The phone's own numbers for a finished drive (local-first part 2b): computed with the same
    rules as the server's, from every fix it recorded, and stored as they are."""

    end_time: AwareDatetime
    distance_meters: float = Field(ge=0)
    duration_seconds: int = Field(ge=0)
    idle_time_seconds: int = Field(ge=0)
    driving_score: int = Field(ge=0, le=100)
    max_g_force: float | None = Field(default=None, ge=0, le=5)
    max_g_source: Literal["sensor", "gps"] | None = None
    left_turns: int = Field(ge=0)
    right_turns: int = Field(ge=0)
    events: list[TripFinishEvent] = Field(default_factory=list, max_length=5000)


class TripUpdateRequest(SchemaBase):
    vehicle_id: UUID


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
    max_g_force: float | None = None
    max_g_source: str | None = None
    left_turns: int | None = None
    right_turns: int | None = None


class TripListRead(TripRead):
    vehicle_name: str
    vehicle_image_url: str | None = None
    driving_score: int | None = None
    avg_speed_mps: float | None = None
    max_speed_mps: float | None = None
    start_address: str | None = None
    end_address: str | None = None
    event_count: int = 0


class TripListTotals(SchemaBase):
    """Totals over every trip matching the filters, not just the returned page."""

    count: int = 0
    distance_meters: float = 0
    duration_seconds: int = 0
    max_speed_mps: float | None = None


class TripRoutePreview(SchemaBase):
    trip_id: UUID
    start_time: AwareDatetime
    distance_meters: float = 0
    duration_seconds: int = 0
    max_speed_mps: float | None = None
    start_address: str | None = None
    end_address: str | None = None
    points: list[tuple[float, float]]


class TripListPage(SchemaBase):
    items: list[TripListRead] = Field(default_factory=list)
    totals: TripListTotals = Field(default_factory=TripListTotals)
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
    # Phone accelerometer peak (G, gravity removed) since the previous point; None without sensors.
    peak_g: float | None = None


class TripEventRead(SchemaBase):
    id: UUID
    trip_id: UUID
    event_type: str
    intensity: float | None = None
    occurred_at: AwareDatetime
    latitude: float | None = None
    longitude: float | None = None
    payload: dict = Field(default_factory=dict)


class TripInsightRead(SchemaBase):
    rule_id: str
    category: str
    tone: str
    title: str
    message: str
    metric_label: str
    metric_value: str
    priority: int


class TripDetailRead(TripRead):
    vehicle_name: str
    vehicle_image_url: str | None = None
    avg_speed_mps: float | None = None
    max_speed_mps: float | None = None
    idle_time_seconds: int
    fuel_used_liters: float | None = None
    cost_amount: float | None = None
    cost_currency: str | None = None
    driving_score: int | None = None
    start_address: str | None = None
    end_address: str | None = None
    location_points: list[TripLocationPointRead] = Field(default_factory=list)
    events: list[TripEventRead] = Field(default_factory=list)
    insights: list[TripInsightRead] = Field(default_factory=list)
