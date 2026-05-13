from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_redis
from app.core.config import settings

router = APIRouter()


def _health_payload() -> dict:
    return {"status": "ok", "app": settings.app_name, "environment": settings.environment}


@router.get("/health")
async def health() -> dict:
    return _health_payload()


@router.get("/healthz")
async def healthz() -> dict:
    return _health_payload()


@router.get("/readyz")
async def readyz(
    db: AsyncSession = Depends(get_db),
    redis_client=Depends(get_redis),
) -> dict:
    await db.execute(text("SELECT 1"))
    await redis_client.ping()
    return {"status": "ready"}
