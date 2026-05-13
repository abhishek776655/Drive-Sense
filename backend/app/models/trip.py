from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    desc,
    Enum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    SmallInteger,
    String,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.base import SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import TripState


class Trip(Base, UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "trips"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    vehicle_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("vehicles.id", ondelete="CASCADE"), nullable=False)

    state: Mapped[TripState] = mapped_column(Enum(TripState, name="drivesense_trip_state"), nullable=False, server_default=text("'started'"))
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    distance_meters: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, server_default=text("0"))
    duration_seconds: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    avg_speed_mps: Mapped[float | None] = mapped_column(Numeric(10, 3))
    max_speed_mps: Mapped[float | None] = mapped_column(Numeric(10, 3))
    idle_time_seconds: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    fuel_used_liters: Mapped[float | None] = mapped_column(Numeric(10, 3))
    cost_amount: Mapped[float | None] = mapped_column(Numeric(12, 2))
    cost_currency: Mapped[str | None] = mapped_column(String(3))
    driving_score: Mapped[int | None] = mapped_column(SmallInteger)

    user: Mapped["User"] = relationship(back_populates="trips")
    vehicle: Mapped["Vehicle"] = relationship(back_populates="trips")
    location_points: Mapped[list["LocationPoint"]] = relationship(back_populates="trip", cascade="all, delete-orphan")
    events: Mapped[list["Event"]] = relationship(back_populates="trip", cascade="all, delete-orphan")

    __table_args__ = (
        CheckConstraint("end_time IS NULL OR end_time >= start_time", name="trips_end_after_start"),
        CheckConstraint("distance_meters >= 0", name="trips_distance_nonnegative"),
        CheckConstraint("duration_seconds >= 0", name="trips_duration_nonnegative"),
        CheckConstraint("idle_time_seconds >= 0", name="trips_idle_time_nonnegative"),
        CheckConstraint("fuel_used_liters IS NULL OR fuel_used_liters >= 0", name="trips_fuel_used_nonnegative"),
        CheckConstraint("cost_amount IS NULL OR cost_amount >= 0", name="trips_cost_nonnegative"),
        CheckConstraint(
            "driving_score IS NULL OR (driving_score >= 0 AND driving_score <= 100)",
            name="trips_score_range",
        ),
        CheckConstraint("cost_currency IS NULL OR cost_currency ~ '^[A-Z]{3}$'", name="trips_currency_format"),
        Index("trips_user_start_time_desc_idx", "user_id", desc("start_time")),
        Index("trips_vehicle_start_time_desc_idx", "vehicle_id", desc("start_time")),
        Index("trips_state_idx", "state"),
        Index("trips_user_active_idx", "user_id", postgresql_where=text("(state <> 'ended' AND deleted_at IS NULL)")),
    )

if TYPE_CHECKING:
    from app.models.event import Event
    from app.models.location_point import LocationPoint
    from app.models.user import User
    from app.models.vehicle import Vehicle
