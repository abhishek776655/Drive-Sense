from __future__ import annotations

from typing import TYPE_CHECKING

from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, LargeBinary, SmallInteger, Text, func
from sqlalchemy.dialects.postgresql import CITEXT
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.base import UUIDPrimaryKeyMixin


class User(Base, UUIDPrimaryKeyMixin):
    __tablename__ = "users"

    # Optional recovery address: accounts are created with a handle and a password.
    email: Mapped[str | None] = mapped_column(CITEXT, nullable=True, unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    # Public @handle, always stored lowercase; unique.
    handle: Mapped[str | None] = mapped_column(Text, unique=True)
    # Profile photo, a small JPEG. Deferred so loading the user never loads the bytes.
    avatar: Mapped[bytes | None] = mapped_column(LargeBinary, deferred=True)
    avatar_updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Onboarding answers: how often they drive (sets the goal and the streak unit), drives per
    # week aimed for, and when the safety terms were accepted (null: onboarding not finished).
    driving_frequency: Mapped[str | None] = mapped_column(Text)
    weekly_goal: Mapped[int | None] = mapped_column(SmallInteger)
    terms_accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    vehicles: Mapped[list["Vehicle"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    trips: Mapped[list["Trip"]] = relationship(back_populates="user", cascade="all, delete-orphan")

    __table_args__ = (
        CheckConstraint("length(trim(email::text)) > 0", name="users_email_nonempty"),
        CheckConstraint("handle IS NULL OR handle ~ '^[a-z0-9_]{3,20}$'", name="users_handle_format"),
        CheckConstraint(
            "driving_frequency IS NULL OR driving_frequency IN ('daily', 'most', 'weekends', 'rarely')",
            name="users_driving_frequency_valid",
        ),
        CheckConstraint("weekly_goal IS NULL OR weekly_goal BETWEEN 1 AND 14", name="users_weekly_goal_range"),
    )

    @property
    def avatar_url(self) -> str | None:
        """Versioned path, so a new photo is a new URL and the old one can be cached forever."""
        if self.avatar_updated_at is None:
            return None
        return f"/api/v1/auth/me/avatar?v={int(self.avatar_updated_at.timestamp())}"

if TYPE_CHECKING:
    from app.models.trip import Trip
    from app.models.vehicle import Vehicle
