from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    desc,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.base import TimestampMixin, UUIDPrimaryKeyMixin


class FuelLog(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "fuel_logs"

    vehicle_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("vehicles.id", ondelete="CASCADE"), nullable=False)
    liters: Mapped[float] = mapped_column(Numeric(10, 3), nullable=False)
    cost_amount: Mapped[float | None] = mapped_column(Numeric(12, 2))
    cost_currency: Mapped[str | None] = mapped_column(String(3))
    odometer_km: Mapped[float | None] = mapped_column(Numeric(12, 1))
    filled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    vehicle: Mapped["Vehicle"] = relationship(back_populates="fuel_logs")

    __table_args__ = (
        CheckConstraint("liters > 0", name="fuel_logs_liters_positive"),
        CheckConstraint("cost_amount IS NULL OR cost_amount >= 0", name="fuel_logs_cost_nonnegative"),
        CheckConstraint("odometer_km IS NULL OR odometer_km >= 0", name="fuel_logs_odometer_nonnegative"),
        CheckConstraint("cost_currency IS NULL OR cost_currency ~ '^[A-Z]{3}$'", name="fuel_logs_currency_format"),
        Index("fuel_logs_vehicle_time_desc_idx", "vehicle_id", desc("filled_at")),
    )

if TYPE_CHECKING:
    from app.models.vehicle import Vehicle
