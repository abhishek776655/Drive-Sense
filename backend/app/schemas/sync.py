from __future__ import annotations

from datetime import datetime
from uuid import UUID

from app.schemas.base import SchemaBase
from app.schemas.trip import TripListRead
from app.schemas.vehicle import VehicleRead


class SyncTrip(TripListRead):
    updated_at: datetime
    # What the phone needs to work out stats and achievements itself (local-first part 2c).
    idle_time_seconds: int = 0
    harsh_brake_count: int = 0
    rapid_acceleration_count: int = 0
    overspeed_count: int = 0
    sharp_turn_count: int = 0


class SyncDeleted(SchemaBase):
    id: UUID
    deleted_at: datetime


class SyncPage(SchemaBase):
    """Everything that changed after the cursor: trips (summaries, oldest change first) and
    vehicles, plus ids deleted since. Pass `cursor` back as `since` until `has_more` is false."""

    vehicles: list[VehicleRead]
    deleted_vehicles: list[SyncDeleted]
    trips: list[SyncTrip]
    deleted_trips: list[SyncDeleted]
    cursor: str | None
    has_more: bool
