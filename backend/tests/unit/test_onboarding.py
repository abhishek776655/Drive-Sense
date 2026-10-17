import uuid
from datetime import date, datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock
from zoneinfo import ZoneInfo

import pytest
from pydantic import ValidationError

from app.main import app
from app.schemas.auth import LoginRequest, RegisterRequest
from app.services.achievement_service import DriveFacts, compute_achievements
from app.services.auth_service import AccountTaken, authenticate_user, looks_like_email, register_user
from app.services.home_stats_service import compute_week_streak, drives_this_week
from app.services.profile_service import DEFAULT_WEEKLY_GOAL, EmailTaken, streak_unit, update_profile


def _db(*owners):
    """A session whose successive `execute` calls return these owners (or users)."""
    results = []
    for owner in owners:
        result = MagicMock()
        result.scalar_one_or_none.return_value = owner
        results.append(result)
    db = MagicMock()
    db.execute = AsyncMock(side_effect=results)
    db.commit = AsyncMock()
    db.rollback = AsyncMock()
    db.refresh = AsyncMock()
    db.add = MagicMock()
    return db


def test_signup_needs_a_handle_and_an_8_character_password_but_no_email():
    assert RegisterRequest(handle="lazarus", password="longenough").email is None
    with pytest.raises(ValidationError):
        RegisterRequest(handle="lazarus", password="short")


def test_login_takes_an_identifier_or_the_old_email_field():
    assert LoginRequest(identifier=" @Lazarus ", password="x").login == "@Lazarus"
    assert LoginRequest(email="demo@drivesense.com", password="x").login == "demo@drivesense.com"
    with pytest.raises(ValidationError):
        LoginRequest(password="x")


def test_emails_are_told_apart_from_handles():
    assert looks_like_email("demo@drivesense.com")
    assert not looks_like_email("@lazarus")
    assert not looks_like_email("lazarus")


async def test_register_saves_a_normalised_handle_and_refuses_taken_ones():
    db = _db(None)
    user = await register_user(db, handle="@Lazarus", password="longenough")
    assert user.handle == "lazarus" and user.email is None
    db.commit.assert_awaited_once()
    with pytest.raises(AccountTaken):
        await register_user(_db(SimpleNamespace()), handle="lazarus", password="longenough")
    with pytest.raises(AccountTaken):
        await register_user(_db(None, SimpleNamespace()), handle="new_one", password="longenough", email="a@b.co")
    with pytest.raises(ValueError):
        await register_user(_db(None), handle="no", password="longenough")


async def test_login_finds_the_user_by_handle_or_email(monkeypatch):
    found = SimpleNamespace(password_hash="hash")
    monkeypatch.setattr("app.services.auth_service.verify_password", lambda pw, h: pw == "right")
    assert await authenticate_user(_db(found), login="@Lazarus", password="right") is found
    assert await authenticate_user(_db(found), login="Demo@DriveSense.com", password="right") is found
    assert await authenticate_user(_db(found), login="lazarus", password="wrong") is None
    assert await authenticate_user(_db(None), login="nobody", password="right") is None


async def test_frequency_sets_the_default_goal_and_terms_are_stamped_once():
    user = SimpleNamespace(id=uuid.uuid4(), handle="lazarus", email=None, driving_frequency=None, weekly_goal=None, terms_accepted_at=None)
    await update_profile(_db(), user=user, driving_frequency="most")
    assert user.driving_frequency == "most" and user.weekly_goal == DEFAULT_WEEKLY_GOAL["most"] == 4
    await update_profile(_db(), user=user, driving_frequency="daily")
    assert user.weekly_goal == 4  # an existing goal is kept
    await update_profile(_db(), user=user, accept_terms=True)
    first = user.terms_accepted_at
    assert first is not None
    await update_profile(_db(), user=user, accept_terms=True)
    assert user.terms_accepted_at == first


async def test_an_email_already_in_use_is_refused():
    user = SimpleNamespace(id=uuid.uuid4(), email=None)
    with pytest.raises(EmailTaken):
        await update_profile(_db(uuid.uuid4()), user=user, email="taken@x.co")
    await update_profile(_db(None), user=user, email="Mine@X.co")
    assert user.email == "mine@x.co"


def test_weekend_and_occasional_drivers_keep_a_week_streak():
    assert streak_unit("weekends") == streak_unit("rarely") == "weeks"
    assert streak_unit("daily") == streak_unit(None) == "days"


def test_week_streak_counts_consecutive_weeks_ending_this_or_last_week():
    today = date(2026, 10, 15)  # Thursday
    saturdays = [date(2026, 10, 10), date(2026, 10, 3), date(2026, 9, 26)]
    assert compute_week_streak(saturdays, today) == 3  # nothing yet this week: last week still counts
    assert compute_week_streak([*saturdays, date(2026, 10, 12)], today) == 4
    assert compute_week_streak([date(2026, 9, 26)], today) == 0
    assert compute_week_streak([], today) == 0


def test_drives_this_week_count_from_monday():
    today = date(2026, 10, 15)
    assert drives_this_week([date(2026, 10, 12), date(2026, 10, 12), date(2026, 10, 15), date(2026, 10, 11)], today) == 3


def test_goal_achievements_need_the_goal_met_and_four_weeks_running():
    start = datetime(2026, 9, 14, 9, tzinfo=timezone.utc)  # a Monday
    drives = [
        DriveFacts(trip_id=uuid.uuid4(), start_time=start + timedelta(weeks=w, days=d), distance_meters=5000, duration_seconds=600, max_g=None, score=80, harsh_events=0)
        for w in range(4)
        for d in range(2)
    ]
    by_id = {a.id: a for a in compute_achievements(drives, ZoneInfo("UTC"), weekly_goal=2)}
    assert by_id["goal_1"].unlocked_at is not None
    assert by_id["goal_4"].unlocked_at == drives[-1].start_time
    locked = {a.id: a for a in compute_achievements(drives, ZoneInfo("UTC"))}
    assert locked["goal_1"].unlocked_at is None and locked["goal_4"].progress == 0


def test_signup_handle_check_is_public():
    route = next(r for r in app.routes if getattr(r, "path", "") == "/api/v1/auth/handle-check")
    assert "GET" in route.methods
