from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password, verify_password
from app.models.user import User


async def get_user_by_email(db: AsyncSession, *, email: str) -> User | None:
    stmt = select(User).where(User.email == email)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def register_user(db: AsyncSession, *, email: str, password: str) -> User:
    normalized_email = email.strip().lower()
    user = User(email=normalized_email, password_hash=hash_password(password))
    db.add(user)
    try:
        await db.commit()
    except IntegrityError as e:
        await db.rollback()
        raise ValueError("Email already registered") from e
    await db.refresh(user)
    return user


async def authenticate_user(db: AsyncSession, *, email: str, password: str) -> User | None:
    user = await get_user_by_email(db, email=email.strip().lower())
    if user is None:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user


def parse_user_id(value: str) -> uuid.UUID:
    return uuid.UUID(value)
