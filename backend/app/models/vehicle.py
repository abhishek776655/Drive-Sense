from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, Enum, ForeignKey, Index, Numeric, Text, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.base import SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import FuelType


class Vehicle(Base, UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "vehicles"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    plate_number: Mapped[str | None] = mapped_column(Text)
    fuel_type: Mapped[FuelType] = mapped_column(Enum(FuelType, name="drivesense_fuel_type"), nullable=False, server_default=text("'other'"))
    tank_capacity_liters: Mapped[float | None] = mapped_column(Numeric(6, 2))
    mileage_baseline_km_per_l: Mapped[float | None] = mapped_column(Numeric(8, 3))

    user: Mapped["User"] = relationship(back_populates="vehicles")
    trips: Mapped[list["Trip"]] = relationship(back_populates="vehicle", cascade="all, delete-orphan")
    fuel_logs: Mapped[list["FuelLog"]] = relationship(back_populates="vehicle", cascade="all, delete-orphan")

    __table_args__ = (
        CheckConstraint("length(trim(name)) > 0", name="vehicles_name_nonempty"),
        CheckConstraint("plate_number IS NULL OR length(trim(plate_number)) > 0", name="vehicles_plate_nonempty"),
        CheckConstraint("tank_capacity_liters IS NULL OR tank_capacity_liters > 0", name="vehicles_tank_capacity_positive"),
        CheckConstraint(
            "mileage_baseline_km_per_l IS NULL OR mileage_baseline_km_per_l > 0",
            name="vehicles_mileage_baseline_positive",
        ),
        Index("vehicles_user_id_idx", "user_id"),
        Index("vehicles_user_active_idx", "user_id", postgresql_where=text("deleted_at IS NULL")),
    )

if TYPE_CHECKING:
    from app.models.fuel_log import FuelLog
    from app.models.trip import Trip
    from app.models.user import User
