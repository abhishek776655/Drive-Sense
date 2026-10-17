from __future__ import annotations

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, get_db
from app.models.user import User
from app.core.security import verify_password
from app.schemas.auth import DeleteAccountRequest
from app.schemas.sync import SyncPage
from app.services.sync_service import delete_cloud_drives, pull

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


@router.post("/delete-drives", status_code=204, response_model=None)
async def sync_delete_drives(
    payload: DeleteAccountRequest = Body(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Deletes every drive from the server for good, after checking the password ("Delete cloud data")."""
    # 403, not 401: the session is fine, only the confirmation was wrong (a 401 signs the app out).
    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Wrong password")
    await delete_cloud_drives(db, user_id=user.id)
