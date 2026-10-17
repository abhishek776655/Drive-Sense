from __future__ import annotations

import uuid

from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password, verify_password
from app.models.user import User
from app.services.profile_service import handle_problem, normalize_handle


async def get_user_by_email(db: AsyncSession, *, email: str) -> User | None:
    stmt = select(User).where(User.email == email)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def get_user_by_handle(db: AsyncSession, *, handle: str) -> User | None:
    return (await db.execute(select(User).where(User.handle == handle))).scalar_one_or_none()


class AccountTaken(ValueError):
    """The handle or the email already belongs to another account."""

    def __init__(self, field: str) -> None:
        super().__init__(f"That {field} is taken")
        self.field = field


async def register_user(db: AsyncSession, *, handle: str, password: str, email: str | None = None) -> User:
    """Creates an account. Raises ValueError (bad handle format) or AccountTaken."""
    normalized = normalize_handle(handle)
    problem = handle_problem(normalized)
    if problem:
        raise ValueError(problem)
    normalized_email = email.strip().lower() if email else None
    if await get_user_by_handle(db, handle=normalized) is not None:
        raise AccountTaken("handle")
    if normalized_email and await get_user_by_email(db, email=normalized_email) is not None:
        raise AccountTaken("email")
    user = User(handle=normalized, email=normalized_email, password_hash=hash_password(password))
    db.add(user)
    try:
        await db.commit()
    except IntegrityError as e:  # taken between the check and the write
        await db.rollback()
        raise AccountTaken("handle") from e
    await db.refresh(user)
    return user


def looks_like_email(login: str) -> bool:
    name, at, domain = login.partition("@")
    return bool(name and at and "." in domain)


async def authenticate_user(db: AsyncSession, *, login: str, password: str) -> User | None:
    """`login` is an email or a handle (with or without the leading @)."""
    login = login.strip()
    if looks_like_email(login):
        user = await get_user_by_email(db, email=login.lower())
    else:
        user = await get_user_by_handle(db, handle=normalize_handle(login))
    if user is None:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user


def parse_user_id(value: str) -> uuid.UUID:
    return uuid.UUID(value)


async def delete_account(db: AsyncSession, *, user: User, password: str) -> bool:
    """Permanently deletes the user and everything they own, after checking the password.

    False (and nothing deleted) when the password is wrong. The database cascades the delete to
    vehicles, trips, location points, events and fuel logs.
    """
    if not verify_password(password, user.password_hash):
        return False
    await db.execute(delete(User).where(User.id == user.id))
    await db.commit()
    return True
