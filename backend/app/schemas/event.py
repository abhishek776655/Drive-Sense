from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import Field

from app.schemas.base import SchemaBase


class EventCreate(SchemaBase):
    trip_id: UUID
    event_type: str = Field(min_length=1, max_length=64)
    intensity: float | None = Field(default=None, ge=0)
    occurred_at: datetime
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    payload: dict = Field(default_factory=dict)


class EventRead(SchemaBase):
    id: UUID
    trip_id: UUID
    event_type: str
    intensity: float | None
    occurred_at: datetime


class EventIngestResponse(SchemaBase):
    trip_id: UUID
    accepted_events: int
