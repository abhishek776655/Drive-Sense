from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Identity,
    Index,
    Text,
    desc,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db.base import Base


class LocationPoint(Base):
    __tablename__ = "location_points"

    trip_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("trips.id", ondelete="CASCADE"),
        primary_key=True,
    )
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), primary_key=True)
    id: Mapped[int] = mapped_column(BigInteger, Identity(always=False), primary_key=True)

    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    speed_mps: Mapped[float | None] = mapped_column(Float)
    heading_deg: Mapped[float | None] = mapped_column(Float)
    accuracy_m: Mapped[float | None] = mapped_column(Float)
    altitude_m: Mapped[float | None] = mapped_column(Float)
    is_moving: Mapped[bool | None] = mapped_column(Boolean)
    provider: Mapped[str | None] = mapped_column(Text)

    ingested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    trip: Mapped["Trip"] = relationship(back_populates="location_points")

    __table_args__ = (
        CheckConstraint("latitude >= -90 AND latitude <= 90", name="location_points_lat_range"),
        CheckConstraint("longitude >= -180 AND longitude <= 180", name="location_points_lon_range"),
        CheckConstraint("speed_mps IS NULL OR speed_mps >= 0", name="location_points_speed_nonnegative"),
        CheckConstraint("heading_deg IS NULL OR (heading_deg >= 0 AND heading_deg <= 360)", name="location_points_heading_range"),
        CheckConstraint("accuracy_m IS NULL OR accuracy_m >= 0", name="location_points_accuracy_nonnegative"),
        Index("location_points_trip_time_desc_idx", "trip_id", desc("recorded_at")),
        Index("location_points_recorded_at_brin_idx", "recorded_at", postgresql_using="brin"),
    )

if TYPE_CHECKING:
    from app.models.trip import Trip
