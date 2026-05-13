from __future__ import annotations

import uuid
from typing import Any, AsyncIterator

import redis.asyncio as redis
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import decode_access_token
from app.db.session import SessionLocal
from app.models.user import User


oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.api_v1_prefix}/auth/login")


async def get_db() -> AsyncIterator[AsyncSession]:
    async with SessionLocal() as session:
        yield session


def get_redis(request: Request) -> redis.Redis[Any]:
    redis_client = getattr(request.app.state, "redis", None)
    if redis_client is None:
        raise RuntimeError("Redis client is not initialized. Ensure app lifespan is configured.")
    return redis_client


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    try:
        payload = decode_access_token(token=token, secret_key=settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
        user_id = uuid.UUID(str(payload["user_id"]))
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user
