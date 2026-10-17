from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from app.schemas.base import SchemaBase

AchievementCategory = Literal["distance", "drives", "time", "streak", "night", "gforce", "smooth"]


class AchievementRead(SchemaBase):
    id: str
    category: AchievementCategory
    title: str
    description: str
    xp: int
    # Threshold and current value, in the category's unit (metres, drives, seconds, days, G).
    target: float
    progress: float
    unlocked_at: datetime | None
    # The drive that unlocked it, so a drive summary can show what it earned.
    trip_id: UUID | None


class AchievementsOverview(SchemaBase):
    xp: int
    level: int
    title: str
    level_start_xp: int
    next_level_xp: int | None
    unlocked: int
    total: int
    achievements: list[AchievementRead]
