from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.sync import SyncPage
from app.services.sync_service import pull

router = APIRouter(prefix="/sync")


@router.get("/pull", response_model=SyncPage)
async def sync_pull(
    since: str | None = Query(default=None, max_length=100),
    limit: int = Query(default=200, ge=1, le=500),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SyncPage:
    """Changes after `since` for the phone's local copy (trips, vehicles, deletions)."""
    return await pull(db, user_id=user.id, since=since, limit=limit)
