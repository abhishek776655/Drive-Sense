from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine

from app.db.base import Base
from app.models import event, fuel_log, location_point, trip, user, vehicle  # noqa: F401


async def ensure_local_schema(engine: AsyncEngine) -> None:
    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS citext"))
        await conn.run_sync(Base.metadata.create_all)
