"""All Stats page (`GET /stats/overview`)."""
from __future__ import annotations

from datetime import date, datetime
from typing import Literal
from uuid import UUID

from app.schemas.base import SchemaBase

StatsPeriod = Literal["week", "month", "year", "all", "custom"]


class StatsSummary(SchemaBase):
    distance_meters: float
    trip_count: int
    avg_distance_meters: float | None
    duration_seconds: int
    avg_duration_seconds: float | None
    avg_speed_mps: float | None
    moving_seconds: int
    idle_seconds: int
    longest_distance_meters: float | None


class StatsTrendBucket(SchemaBase):
    start: date
    distance_meters: float
    duration_seconds: int
    avg_speed_mps: float | None
    max_speed_mps: float | None
    max_g: float | None
    avg_score: float | None = None


class StatsTrend(SchemaBase):
    granularity: Literal["day", "month"]
    buckets: list[StatsTrendBucket]


class SpeedDistributionBand(SchemaBase):
    label: str
    trips: int


class TimeAtSpeedBand(SchemaBase):
    label: str
    seconds: float
    meters: float


class RecordTrip(SchemaBase):
    trip_id: UUID
    value: float
    start_time: datetime
    end_address: str | None


class StatsRecords(SchemaBase):
    top_speed: RecordTrip | None
    longest_distance: RecordTrip | None
    longest_duration: RecordTrip | None
    best_score: RecordTrip | None


class TopDay(SchemaBase):
    date: date
    distance_meters: float
    trip_count: int


class StatsStreaks(SchemaBase):
    current_days: int
    best_days: int


class VisitedPlace(SchemaBase):
    name: str
    visits: int


class StatsEvents(SchemaBase):
    harsh_brake: int
    rapid_acceleration: int
    overspeed: int
    sharp_turn: int = 0
    # All four per 100 km driven, so long and short periods compare fairly; None with no distance.
    per_100km: float | None


class StatsSpeeding(SchemaBase):
    limit_kmh: float
    # Moving time above the limit, and its share of all moving time (0..1).
    seconds: float
    share: float | None


class DriveShare(SchemaBase):
    label: str
    trips: int
    distance_meters: float


class StatsOverview(SchemaBase):
    period: StatsPeriod
    since: datetime | None
    # End of the range (exclusive); only a custom range has one.
    until: datetime | None = None
    summary: StatsSummary
    trend: StatsTrend
    speed_distribution: list[SpeedDistributionBand]
    time_at_speed: list[TimeAtSpeedBand]
    records: StatsRecords
    top_days: list[TopDay]
    streaks: StatsStreaks
    places: list[VisitedPlace]
    events: StatsEvents | None = None
    speeding: StatsSpeeding | None = None
    elevation_gain_m: float | None = None
    # Morning, afternoon, evening, night; then Monday to Sunday.
    time_of_day: list[DriveShare] = []
    weekdays: list[DriveShare] = []
    # When drives start, hour by hour ("00".."23", local time).
    hours: list[DriveShare] = []
