from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import Field

from app.schemas.base import SchemaBase


class MetricSummary(SchemaBase):
    total_vehicles: int
    total_trips: int
    active_trips: int
    total_distance_meters: float
    total_duration_seconds: int
    total_fuel_used_liters: float
    total_fuel_cost_amount: float
    avg_driving_score: float | None


class RecentEventSummary(SchemaBase):
    event_id: UUID
    trip_id: UUID
    vehicle_id: UUID
    vehicle_name: str
    vehicle_image_url: str | None = None
    event_type: str
    occurred_at: datetime
    intensity: float | None = None


class RecentEventPage(SchemaBase):
    items: list[RecentEventSummary] = Field(default_factory=list)
    total: int = 0
    limit: int = 0
    offset: int = 0


class TrendPoint(SchemaBase):
    bucket_start: datetime
    trip_count: int = 0
    distance_meters: float = 0
    fuel_used_liters: float = 0
    fuel_cost_amount: float = 0
    avg_driving_score: float | None = None


class TrendSeries(SchemaBase):
    """Two adjacent equal-length windows of the same metric, oldest bucket first.

    The split lives on the server so every client compares the same spans; slicing a flat series
    client-side silently drops the empty buckets the server never emits.
    """

    granularity: str
    bucket_count: int
    previous: list[TrendPoint] = Field(default_factory=list)
    current: list[TrendPoint] = Field(default_factory=list)


class EventBreakdown(SchemaBase):
    harsh_brake_count: int = 0
    rapid_acceleration_count: int = 0
    overspeed_count: int = 0
    total_events: int = 0


class RecentTripSummary(SchemaBase):
    trip_id: UUID
    vehicle_id: UUID
    vehicle_name: str
    vehicle_image_url: str | None = None
    state: str
    start_time: datetime
    end_time: datetime | None
    distance_meters: float
    duration_seconds: int
    driving_score: int | None
    avg_speed_mps: float | None = None
    max_speed_mps: float | None = None
    start_address: str | None = None
    end_address: str | None = None
    event_count: int = 0


class VehicleDashboardSummary(SchemaBase):
    vehicle_id: UUID
    vehicle_name: str
    vehicle_image_url: str | None = None
    company_name: str
    model_name: str
    nickname: str | None = None
    plate_number: str | None = None
    fuel_type: str
    mileage_baseline_km_per_l: float | None = None
    trip_count: int
    total_distance_meters: float
    total_fuel_used_liters: float
    avg_driving_score: float | None
    last_trip_at: datetime | None


class DashboardResponse(SchemaBase):
    summary: MetricSummary
    week_summary: MetricSummary
    today_summary: MetricSummary
    trend: list[TrendPoint]
    events: EventBreakdown
    vehicles: list[VehicleDashboardSummary]
    recent_trips: list[RecentTripSummary]
    recent_events: list[RecentEventSummary]


class VehicleStatsSummary(SchemaBase):
    vehicle_id: UUID
    vehicle_name: str
    vehicle_image_url: str | None = None
    fuel_type: str
    trip_count: int
    active_trip_count: int
    total_distance_meters: float
    total_duration_seconds: int
    total_fuel_used_liters: float
    total_fuel_cost_amount: float
    avg_driving_score: float | None
    last_trip_at: datetime | None


class VehicleStatsResponse(SchemaBase):
    summary: VehicleStatsSummary
    trip_trend: list[TrendPoint]
    fuel_trend: list[TrendPoint]
    events: EventBreakdown
    recent_trips: list[RecentTripSummary]
