from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.achievements import AchievementsOverview
from app.services.achievement_service import get_achievements

router = APIRouter(prefix="/achievements")


@router.get("", response_model=AchievementsOverview)
async def list_achievements(
    tz: str | None = Query(default=None, max_length=64, description="IANA time zone, for night drives and streaks"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AchievementsOverview:
    return await get_achievements(db, user_id=user.id, tz=tz, weekly_goal=user.weekly_goal)
