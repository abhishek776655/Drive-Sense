from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_redis
from app.core.config import settings

router = APIRouter()


@router.get("/healthz")
async def healthz() -> dict:
    return {"status": "ok", "app": settings.app_name, "environment": settings.environment}


@router.get("/readyz")
async def readyz(
    db: AsyncSession = Depends(get_db),
    redis_client=Depends(get_redis),
) -> dict:
    await db.execute(text("SELECT 1"))
    await redis_client.ping()
    return {"status": "ready"}

