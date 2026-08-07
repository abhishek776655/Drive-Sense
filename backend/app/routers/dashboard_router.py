from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.dashboard import DashboardResponse, RecentEventPage, VehicleStatsResponse
from app.schemas.trip import TripInsightRead
from app.services.dashboard_service import (
    get_dashboard_data,
    get_recent_events_page,
    get_recurring_insights_data,
    get_vehicle_stats_data,
)

router = APIRouter()


@router.get("/dashboard", response_model=DashboardResponse)
async def get_dashboard(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DashboardResponse:
    return await get_dashboard_data(db, user_id=user.id)


@router.get("/dashboard/events", response_model=RecentEventPage)
async def get_dashboard_events(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RecentEventPage:
    return await get_recent_events_page(db, user_id=user.id, limit=limit, offset=offset)


@router.get("/dashboard/insights", response_model=list[TripInsightRead])
async def get_dashboard_insights(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[TripInsightRead]:
    insights = await get_recurring_insights_data(db, user_id=user.id)
    return [
        TripInsightRead(
            rule_id=insight.rule_id,
            category=insight.category,
            tone=insight.tone,
            title=insight.title,
            message=insight.message,
            metric_label=insight.metric_label,
            metric_value=insight.metric_value,
            priority=insight.priority,
        )
        for insight in insights
    ]


@router.get("/vehicles/{vehicle_id}/stats", response_model=VehicleStatsResponse)
async def get_vehicle_stats(
    vehicle_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> VehicleStatsResponse:
    stats = await get_vehicle_stats_data(db, user_id=user.id, vehicle_id=vehicle_id)
    if stats is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vehicle not found")
    return stats
