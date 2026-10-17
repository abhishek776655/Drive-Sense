from __future__ import annotations

from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.stats import StatsOverview, StatsPeriod
from app.services.stats_overview_service import get_stats_overview
from app.services.vehicle_service import get_vehicle

router = APIRouter(prefix="/stats")


@router.get("/overview", response_model=StatsOverview)
async def get_overview(
    period: StatsPeriod = Query(default="month"),
    vehicle_id: UUID | None = Query(default=None),
    start: date | None = Query(default=None, description="First local day of a custom range"),
    end: date | None = Query(default=None, description="Last local day (inclusive) of a custom range"),
    over_kmh: float = Query(default=100, ge=20, le=250, description="Speeding limit for the time-over figure (the app's speed alert)"),
    tz: str | None = Query(default=None, max_length=64, description="IANA time zone, e.g. Asia/Kolkata"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> StatsOverview:
    if period == "custom" and (start is None or end is None or end < start):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="A custom range needs start <= end")
    if period == "custom" and (end - start).days > 3660:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="A custom range is at most ten years")
    if vehicle_id is not None and await get_vehicle(db, user_id=user.id, vehicle_id=vehicle_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vehicle not found")
    return await get_stats_overview(db, user_id=user.id, period=period, tz=tz, vehicle_id=vehicle_id, start=start, end=end, over_kmh=over_kmh)
