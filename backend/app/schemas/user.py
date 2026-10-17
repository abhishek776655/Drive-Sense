from __future__ import annotations

from datetime import datetime
from uuid import UUID

from typing import Literal

from pydantic import EmailStr, Field

from app.schemas.base import SchemaBase


class UserCreate(SchemaBase):
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=8, max_length=256)


DrivingFrequency = Literal["daily", "most", "weekends", "rarely"]


class UserRead(SchemaBase):
    id: UUID
    email: str | None = None
    handle: str | None = None
    avatar_url: str | None = None
    driving_frequency: DrivingFrequency | None = None
    weekly_goal: int | None = None
    # Null until the safety terms are accepted, which is the last onboarding step.
    terms_accepted_at: datetime | None = None
    created_at: datetime


class ProfileUpdate(SchemaBase):
    """Every field optional: send only what changed."""

    handle: str | None = Field(default=None, min_length=1, max_length=40)
    email: EmailStr | None = None
    driving_frequency: DrivingFrequency | None = None
    weekly_goal: int | None = Field(default=None, ge=1, le=14)
    accept_terms: bool | None = None


class HandleAvailability(SchemaBase):
    handle: str
    available: bool
    # Why it cannot be used: "taken", or what is wrong with its format.
    reason: str | None = None
