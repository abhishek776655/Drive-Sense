from __future__ import annotations

from typing import TYPE_CHECKING

from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, Text, func
from sqlalchemy.dialects.postgresql import CITEXT
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.base import UUIDPrimaryKeyMixin


class User(Base, UUIDPrimaryKeyMixin):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(CITEXT, nullable=False, unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    vehicles: Mapped[list["Vehicle"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    trips: Mapped[list["Trip"]] = relationship(back_populates="user", cascade="all, delete-orphan")

    __table_args__ = (
        CheckConstraint("length(trim(email::text)) > 0", name="users_email_nonempty"),
    )

if TYPE_CHECKING:
    from app.models.trip import Trip
    from app.models.vehicle import Vehicle
