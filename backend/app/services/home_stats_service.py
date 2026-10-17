"""All-time stats for the v2 Home screen (`GET /dashboard/home`)."""
from __future__ import annotations

import uuid
from collections.abc import Iterable
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import Date, case, cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import TripState
from app.models.event import Event
from app.models.location_point import LocationPoint
from app.models.trip import Trip
from app.schemas.dashboard import HomeAltitude, HomeEvents, HomeMaxG, HomeScore, HomeStats, HomeTurns, HomeWeekGoal
from app.services.profile_service import streak_unit
from app.services.trip_service import close_stale_trips

SCORE_WINDOW_DAYS = 7


def resolve_zone(tz: str | None) -> ZoneInfo:
    """The user's IANA zone, falling back to UTC for anything unknown."""
    try:
        return ZoneInfo(tz) if tz else ZoneInfo("UTC")
    except (ZoneInfoNotFoundError, ValueError):
        return ZoneInfo("UTC")


def compute_streak(drive_days: Iterable[date], today: date) -> int:
    """Consecutive local days with a drive, ending today or yesterday (a streak survives until the
    end of the day after the last drive). Zero when the latest drive is older than that."""
    days = set(drive_days)
    if not days:
        return 0
    cursor = today if today in days else today - timedelta(days=1)
    streak = 0
    while cursor in days:
        streak += 1
        cursor -= timedelta(days=1)
    return streak


def week_start(day: date) -> date:
    """Monday of the ISO week holding `day`."""
    return day - timedelta(days=day.weekday())


def compute_week_streak(drive_days: Iterable[date], today: date) -> int:
    """Consecutive weeks (Monday start) with at least one drive, ending this week or last week."""
    weeks = {week_start(d) for d in drive_days}
    if not weeks:
        return 0
    this_week = week_start(today)
    cursor = this_week if this_week in weeks else this_week - timedelta(days=7)
    streak = 0
    while cursor in weeks:
        streak += 1
        cursor -= timedelta(days=7)
    return streak


def drives_this_week(drive_starts: Iterable[date], today: date) -> int:
    """Drives (one entry per drive, as local start days) since Monday."""
    monday = week_start(today)
    return sum(1 for d in drive_starts if monday <= d <= today)


def score_delta(current: float | None, previous: float | None) -> float | None:
    """Change in average score between the two windows; only when both have scored trips."""
    if current is None or previous is None:
        return None
    return current - previous


async def get_home_stats(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    tz: str | None,
    now: datetime | None = None,
    vehicle_id: uuid.UUID | None = None,
    frequency: str | None = None,
    weekly_goal: int | None = None,
) -> HomeStats:
    """All-time stats over the user's ended trips; `vehicle_id` narrows them to one vehicle (Garage)."""
    effective_now = now or datetime.now(timezone.utc)
    await close_stale_trips(db, user_id=user_id, now=effective_now)
    zone = resolve_zone(tz)

    ended = (Trip.user_id == user_id, Trip.deleted_at.is_(None), Trip.state == TripState.ended)
    if vehicle_id is not None:
        ended = (*ended, Trip.vehicle_id == vehicle_id)

    totals = (
        await db.execute(
            select(
                func.count(Trip.id),
                func.coalesce(func.sum(Trip.distance_meters), 0),
                func.coalesce(func.sum(Trip.duration_seconds), 0),
                func.coalesce(func.sum(func.greatest(Trip.duration_seconds - Trip.idle_time_seconds, 0)), 0),
                func.max(case((Trip.max_speed_mps > 0, Trip.max_speed_mps), else_=None)),
            ).where(*ended)
        )
    ).one()
    trip_count = int(totals[0] or 0)
    distance = float(totals[1] or 0)
    duration = int(totals[2] or 0)
    moving = int(totals[3] or 0)

    window_start = effective_now - timedelta(days=SCORE_WINDOW_DAYS)
    previous_start = window_start - timedelta(days=SCORE_WINDOW_DAYS)
    scores = (
        await db.execute(
            select(
                func.avg(case((Trip.start_time >= window_start, Trip.driving_score), else_=None)),
                func.avg(case(((Trip.start_time >= previous_start) & (Trip.start_time < window_start), Trip.driving_score), else_=None)),
            ).where(*ended)
        )
    ).one()
    current_score = float(scores[0]) if scores[0] is not None else None
    previous_score = float(scores[1]) if scores[1] is not None else None

    max_g_row = (
        await db.execute(
            select(Trip.max_g_force, Trip.max_g_source)
            .where(*ended, Trip.max_g_force.is_not(None))
            .order_by(Trip.max_g_force.desc())
            .limit(1)
        )
    ).first()

    turns = (
        await db.execute(
            select(func.sum(Trip.left_turns), func.sum(Trip.right_turns)).where(*ended, Trip.left_turns.is_not(None))
        )
    ).one()

    events = (
        await db.execute(
            select(
                func.coalesce(func.sum(case((Event.event_type == "rapid_acceleration", 1), else_=0)), 0),
                func.coalesce(func.sum(case((Event.event_type == "harsh_brake", 1), else_=0)), 0),
            )
            .join(Trip, Trip.id == Event.trip_id)
            .where(*ended)
        )
    ).one()

    altitude = (
        await db.execute(
            select(func.max(LocationPoint.altitude_m), func.min(LocationPoint.altitude_m))
            .join(Trip, Trip.id == LocationPoint.trip_id)
            # Exactly 0.0 is what phones (and the simulator) report when they have no altitude fix.
            .where(*ended, LocationPoint.altitude_m.is_not(None), LocationPoint.altitude_m != 0)
        )
    ).one()

    local_day = cast(func.timezone(zone.key, Trip.start_time), Date)
    drive_starts = (await db.execute(select(local_day).where(*ended))).scalars().all()
    drive_days = set(drive_starts)
    today = effective_now.astimezone(zone).date()
    unit = streak_unit(frequency)
    streak = compute_week_streak(drive_days, today) if unit == "weeks" else compute_streak(drive_days, today)

    return HomeStats(
        top_speed_mps=float(totals[4]) if totals[4] is not None else None,
        total_distance_meters=distance if trip_count else None,
        streak_days=streak if trip_count else None,
        streak_unit=unit,
        week_goal=HomeWeekGoal(target=weekly_goal, done=drives_this_week(drive_starts, today)) if weekly_goal else None,
        avg_speed_mps=distance / moving if moving > 0 and distance > 0 else None,
        score=HomeScore(current=current_score, delta=score_delta(current_score, previous_score))
        if current_score is not None
        else None,
        trip_count=trip_count or None,
        drive_time_seconds=duration if trip_count else None,
        avg_trip_distance_meters=distance / trip_count if trip_count else None,
        max_g=HomeMaxG(value=float(max_g_row[0]), estimated=max_g_row[1] != "sensor") if max_g_row else None,
        turns=HomeTurns(left=int(turns[0]), right=int(turns[1])) if turns[0] is not None else None,
        events=HomeEvents(accel=int(events[0]), brake=int(events[1])) if trip_count else None,
        altitude=HomeAltitude(highest_m=float(altitude[0]), lowest_m=float(altitude[1])) if altitude[0] is not None else None,
    )
