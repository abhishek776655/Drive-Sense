"""The user's public @handle and profile photo."""
from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User

HANDLE_MIN = 3
HANDLE_MAX = 20
_HANDLE_RE = re.compile(r"^[a-z0-9_]+$")


class HandleTaken(Exception):
    pass


class EmailTaken(Exception):
    pass


#: Drives per week aimed for, by how often the user said they drive.
DEFAULT_WEEKLY_GOAL = {"daily": 7, "most": 4, "weekends": 2, "rarely": 1}


def streak_unit(frequency: str | None) -> str:
    """Weekend and occasional drivers keep a week streak, so a quiet weekday doesn't break it."""
    return "weeks" if frequency in ("weekends", "rarely") else "days"


def normalize_handle(raw: str) -> str:
    """What the user typed, as stored: no leading @, no spaces, lowercase."""
    return raw.strip().lstrip("@").strip().lower()


def handle_problem(handle: str) -> str | None:
    """Why a (normalised) handle cannot be used, or None when its format is fine."""
    if len(handle) < HANDLE_MIN:
        return f"At least {HANDLE_MIN} characters"
    if len(handle) > HANDLE_MAX:
        return f"At most {HANDLE_MAX} characters"
    if not _HANDLE_RE.match(handle):
        return "Letters, numbers and _ only"
    return None


async def handle_owner(db: AsyncSession, handle: str) -> uuid.UUID | None:
    return (await db.execute(select(User.id).where(User.handle == handle))).scalar_one_or_none()


async def handle_availability(db: AsyncSession, *, user_id: uuid.UUID | None, raw: str) -> tuple[str, bool, str | None]:
    """(normalised handle, available, reason). The user's own handle counts as available; with no
    user (signing up) any owner means taken."""
    handle = normalize_handle(raw)
    problem = handle_problem(handle)
    if problem:
        return handle, False, problem
    owner = await handle_owner(db, handle)
    if owner is not None and owner != user_id:
        return handle, False, "taken"
    return handle, True, None


async def set_handle(db: AsyncSession, *, user: User, raw: str) -> User:
    """Raises ValueError (bad format) or HandleTaken."""
    handle, available, reason = await handle_availability(db, user_id=user.id, raw=raw)
    if not available:
        raise HandleTaken() if reason == "taken" else ValueError(reason)
    user.handle = handle
    try:
        await db.commit()
    except IntegrityError as exc:  # taken between the check and the write
        await db.rollback()
        raise HandleTaken() from exc
    return user


async def set_avatar(db: AsyncSession, *, user: User, photo: bytes | None) -> User:
    user.avatar = photo
    user.avatar_updated_at = datetime.now(timezone.utc) if photo is not None else None
    await db.commit()
    return user


async def get_avatar(db: AsyncSession, *, user_id: uuid.UUID) -> bytes | None:
    return (await db.execute(select(User.avatar).where(User.id == user_id))).scalar_one_or_none()


async def update_profile(
    db: AsyncSession,
    *,
    user: User,
    handle: str | None = None,
    email: str | None = None,
    driving_frequency: str | None = None,
    weekly_goal: int | None = None,
    accept_terms: bool | None = None,
) -> User:
    """Applies the fields that were sent. Raises ValueError (bad handle), HandleTaken or EmailTaken."""
    if handle is not None:
        normalised, available, reason = await handle_availability(db, user_id=user.id, raw=handle)
        if not available:
            raise HandleTaken() if reason == "taken" else ValueError(reason)
        user.handle = normalised
    if email is not None:
        address = email.strip().lower()
        owner = (await db.execute(select(User.id).where(User.email == address))).scalar_one_or_none()
        if owner is not None and owner != user.id:
            raise EmailTaken()
        user.email = address
    if driving_frequency is not None:
        user.driving_frequency = driving_frequency
        if user.weekly_goal is None and weekly_goal is None:
            user.weekly_goal = DEFAULT_WEEKLY_GOAL[driving_frequency]
    if weekly_goal is not None:
        user.weekly_goal = weekly_goal
    if accept_terms and user.terms_accepted_at is None:
        user.terms_accepted_at = datetime.now(timezone.utc)
    try:
        await db.commit()
    except IntegrityError as exc:  # handle or email taken between the check and the write
        await db.rollback()
        raise HandleTaken() from exc
    return user
