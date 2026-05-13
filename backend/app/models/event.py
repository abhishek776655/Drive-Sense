from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Numeric,
    Text,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base
from app.models.base import TimestampMixin, UUIDPrimaryKeyMixin


class Event(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "events"

    trip_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("trips.id", ondelete="CASCADE"), nullable=False)
    event_type: Mapped[str] = mapped_column(Text, nullable=False)
    intensity: Mapped[float | None] = mapped_column(Numeric(10, 3))
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False, server_default=text("'{}'::jsonb"))

    trip: Mapped["Trip"] = relationship(back_populates="events")

    __table_args__ = (
        CheckConstraint("length(trim(event_type)) > 0", name="events_type_nonempty"),
        CheckConstraint("intensity IS NULL OR intensity >= 0", name="events_intensity_nonnegative"),
        CheckConstraint("latitude IS NULL OR (latitude >= -90 AND latitude <= 90)", name="events_lat_range"),
        CheckConstraint("longitude IS NULL OR (longitude >= -180 AND longitude <= 180)", name="events_lon_range"),
        Index("events_trip_time_desc_idx", "trip_id", "occurred_at"),
        Index("events_type_time_desc_idx", "event_type", "occurred_at"),
    )

if TYPE_CHECKING:
    from app.models.trip import Trip
