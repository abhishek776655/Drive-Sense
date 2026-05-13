from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncIterator, Any

from fastapi import FastAPI

from app.core.config import settings
from app.core.redis import create_redis_client
from app.db.bootstrap import ensure_local_schema
from app.db.session import engine


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    if settings.environment == "prod" and settings.jwt_secret_key == "CHANGE_ME":
        raise RuntimeError("JWT_SECRET_KEY must be set in production")

    if settings.environment in {"local", "dev"}:
        await ensure_local_schema(engine)

    app.state.redis = create_redis_client(settings.redis_url)
    try:
        yield
    finally:
        redis_client = getattr(app.state, "redis", None)
        if redis_client is not None:
            await redis_client.aclose()
