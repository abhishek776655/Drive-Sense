from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.base import TimestampMixin, UUIDPrimaryKeyMixin


class VehicleCompany(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "vehicle_companies"

    name: Mapped[str] = mapped_column(Text, nullable=False, unique=True)

    models: Mapped[list["VehicleModel"]] = relationship(back_populates="company")


class VehicleModel(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "vehicle_models"

    company_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("vehicle_companies.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    image_url: Mapped[str | None] = mapped_column(Text)

    company: Mapped["VehicleCompany"] = relationship(back_populates="models")
    vehicles: Mapped[list["Vehicle"]] = relationship(back_populates="model")

    __table_args__ = (UniqueConstraint("company_id", "name", name="vehicle_models_company_id_name_key"),)


if TYPE_CHECKING:
    from app.models.vehicle import Vehicle
