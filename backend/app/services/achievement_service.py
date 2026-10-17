"""Achievements, XP and levels, worked out from the user's drives (nothing is stored).

Every achievement is a running total crossing a threshold; walking the drives in order finds the
drive (and so the date) that crossed it. Deleting a drive simply re-locks what it earned.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import TripState
from app.models.event import Event
from app.models.trip import Trip
from app.schemas.achievements import AchievementRead, AchievementsOverview
from app.services.home_stats_service import resolve_zone

KM = 1000.0
HOUR = 3600.0
NIGHT_START_HOUR = 20
NIGHT_END_HOUR = 5
SMOOTH_SCORE = 90
# A drive this short says nothing about smooth driving.
CLEAN_MIN_METERS = 1000.0


@dataclass(frozen=True)
class Achievement:
    id: str
    category: str
    title: str
    description: str
    target: float
    xp: int


def _a(id: str, category: str, title: str, description: str, target: float, xp: int) -> Achievement:
    return Achievement(id, category, title, description, target, xp)


CATALOG: list[Achievement] = [
    _a("distance_10", "distance", "First Miles", "Drive a total of 10 km", 10 * KM, 50),
    _a("distance_50", "distance", "Getting Rolling", "Drive a total of 50 km", 50 * KM, 75),
    _a("distance_100", "distance", "Century Club", "Drive a total of 100 km", 100 * KM, 100),
    _a("distance_250", "distance", "Road Tripper", "Drive a total of 250 km", 250 * KM, 150),
    _a("distance_500", "distance", "Explorer", "Drive a total of 500 km", 500 * KM, 200),
    _a("distance_1000", "distance", "Thousand Club", "Drive a total of 1,000 km", 1000 * KM, 300),
    _a("distance_2500", "distance", "Long Hauler", "Drive a total of 2,500 km", 2500 * KM, 400),
    _a("distance_5000", "distance", "Road Warrior", "Drive a total of 5,000 km", 5000 * KM, 500),
    _a("drives_1", "drives", "First Drive", "Complete your first drive", 1, 25),
    _a("drives_5", "drives", "Warming Up", "Complete 5 drives", 5, 50),
    _a("drives_10", "drives", "Regular Driver", "Complete 10 drives", 10, 75),
    _a("drives_20", "drives", "Dedicated", "Complete 20 drives", 20, 100),
    _a("drives_50", "drives", "Behind the Wheel", "Complete 50 drives", 50, 200),
    _a("drives_100", "drives", "Centurion", "Complete 100 drives", 100, 300),
    _a("drives_200", "drives", "Veteran", "Complete 200 drives", 200, 400),
    _a("drives_500", "drives", "Five Hundred Club", "Complete 500 drives", 500, 500),
    _a("time_1", "time", "First Hour", "Drive for a total of 1 hour", 1 * HOUR, 50),
    _a("time_5", "time", "Road Time", "Drive for a total of 5 hours", 5 * HOUR, 100),
    _a("time_10", "time", "Seasoned Driver", "Drive for a total of 10 hours", 10 * HOUR, 150),
    _a("time_25", "time", "Time Traveler", "Drive for a total of 25 hours", 25 * HOUR, 250),
    _a("time_50", "time", "Iron Seat", "Drive for a total of 50 hours", 50 * HOUR, 400),
    _a("streak_3", "streak", "Three-Peat", "Drive 3 days in a row", 3, 75),
    _a("streak_7", "streak", "Weekly Warrior", "Drive 7 days in a row", 7, 150),
    _a("streak_14", "streak", "Fortnight Force", "Drive 14 days in a row", 14, 250),
    _a("streak_30", "streak", "Monthly Master", "Drive 30 days in a row", 30, 500),
    _a("goal_1", "streak", "Goal Getter", "Reach your weekly drive goal", 1, 75),
    _a("goal_4", "streak", "On a Roll", "Reach your weekly goal 4 weeks in a row", 4, 250),
    _a("night_1", "night", "Night Owl", "Complete 1 night drive", 1, 50),
    _a("night_5", "night", "Midnight Cruiser", "Complete 5 night drives", 5, 100),
    _a("night_10", "night", "Creature of the Night", "Complete 10 night drives", 10, 150),
    _a("night_25", "night", "Nocturnal", "Complete 25 night drives", 25, 300),
    _a("gforce_05", "gforce", "Feeling the Force", "Experience 0.5 G", 0.5, 50),
    _a("gforce_08", "gforce", "Pulling G's", "Experience 0.8 G", 0.8, 100),
    _a("smooth_1", "smooth", "Smooth Operator", "Score 90+ on a drive", 1, 50),
    _a("smooth_5", "smooth", "Steady Hands", "Score 90+ on 5 drives", 5, 100),
    _a("smooth_25", "smooth", "Silk Road", "Score 90+ on 25 drives", 25, 200),
    _a("smooth_50", "smooth", "Zen Driver", "Score 90+ on 50 drives", 50, 300),
    _a("clean_10", "smooth", "Clean Sheet", "10 drives with no harsh braking or acceleration", 10, 150),
]

# Cumulative XP needed to reach each level (level 1 starts at 0); grows by 50 more every level.
_LEVEL_XP = [0]
for step in range(100, 100 + 50 * 40, 50):
    _LEVEL_XP.append(_LEVEL_XP[-1] + step)

_TITLES = [(14, "Road Legend"), (11, "Highway Hero"), (8, "Road Captain"), (5, "Cruiser"), (3, "Commuter"), (2, "Rookie"), (1, "Learner")]


def level_for(xp: int) -> tuple[int, str, int, int | None]:
    """(level, title, XP where this level starts, XP where the next starts or None at the top)."""
    level = max(i + 1 for i, need in enumerate(_LEVEL_XP) if xp >= need)
    title = next(name for floor, name in _TITLES if level >= floor)
    start = _LEVEL_XP[level - 1]
    nxt = _LEVEL_XP[level] if level < len(_LEVEL_XP) else None
    return level, title, start, nxt


@dataclass
class DriveFacts:
    trip_id: uuid.UUID
    start_time: datetime
    distance_meters: float
    duration_seconds: float
    max_g: float | None
    score: int | None
    harsh_events: int


def is_night(start_local: datetime) -> bool:
    return start_local.hour >= NIGHT_START_HOUR or start_local.hour < NIGHT_END_HOUR


def compute_achievements(drives: list[DriveFacts], zone: ZoneInfo, weekly_goal: int | None = None) -> list[AchievementRead]:
    """Walks the drives oldest first; each achievement unlocks at the drive whose running total
    first reaches its target. Progress is the total so far (best value for streaks and G).
    `weekly_goal` (drives per week, from onboarding) drives the goal achievements; without one
    they stay locked."""
    ordered = sorted(drives, key=lambda d: d.start_time)
    totals = {
        "distance": 0.0, "drives": 0.0, "time": 0.0, "night": 0.0, "gforce": 0.0, "smooth": 0.0, "clean": 0.0, "streak": 0.0,
        "goal_weeks": 0.0, "goal_run": 0.0,
    }
    week_drives: dict[date, int] = {}
    goal_runs: dict[date, int] = {}
    unlocked: dict[str, tuple[datetime, uuid.UUID]] = {}
    streak = 0
    last_day: date | None = None

    for drive in ordered:
        local = drive.start_time.astimezone(zone)
        day = local.date()
        if day != last_day:
            streak = streak + 1 if last_day is not None and day - last_day == timedelta(days=1) else 1
            last_day = day
        totals["distance"] += drive.distance_meters
        totals["drives"] += 1
        totals["time"] += drive.duration_seconds
        totals["night"] += 1 if is_night(local) else 0
        totals["gforce"] = max(totals["gforce"], drive.max_g or 0.0)
        totals["smooth"] += 1 if (drive.score or 0) >= SMOOTH_SCORE else 0
        totals["clean"] += 1 if drive.harsh_events == 0 and drive.distance_meters >= CLEAN_MIN_METERS else 0
        totals["streak"] = max(totals["streak"], streak)
        if weekly_goal:
            week = day - timedelta(days=day.weekday())
            week_drives[week] = week_drives.get(week, 0) + 1
            if week_drives[week] == weekly_goal:  # the drive that met this week's goal
                goal_runs[week] = goal_runs.get(week - timedelta(days=7), 0) + 1
                totals["goal_weeks"] += 1
                totals["goal_run"] = max(totals["goal_run"], goal_runs[week])
        for achievement in CATALOG:
            if achievement.id not in unlocked and totals[_key(achievement)] >= achievement.target:
                unlocked[achievement.id] = (drive.start_time, drive.trip_id)

    return [
        AchievementRead(
            id=a.id,
            category=a.category,  # type: ignore[arg-type]
            title=a.title,
            description=a.description,
            xp=a.xp,
            target=a.target,
            progress=min(totals[_key(a)], a.target),
            unlocked_at=unlocked[a.id][0] if a.id in unlocked else None,
            trip_id=unlocked[a.id][1] if a.id in unlocked else None,
        )
        for a in CATALOG
    ]


def _key(achievement: Achievement) -> str:
    if achievement.id.startswith("clean"):
        return "clean"
    if achievement.id == "goal_1":
        return "goal_weeks"
    if achievement.id == "goal_4":
        return "goal_run"
    return achievement.category


def overview(achievements: list[AchievementRead]) -> AchievementsOverview:
    xp = sum(a.xp for a in achievements if a.unlocked_at is not None)
    level, title, start, nxt = level_for(xp)
    return AchievementsOverview(
        xp=xp,
        level=level,
        title=title,
        level_start_xp=start,
        next_level_xp=nxt,
        unlocked=sum(1 for a in achievements if a.unlocked_at is not None),
        total=len(achievements),
        achievements=achievements,
    )


async def get_achievements(
    db: AsyncSession, *, user_id: uuid.UUID, tz: str | None, weekly_goal: int | None = None
) -> AchievementsOverview:
    harsh = func.coalesce(func.sum(case((Event.event_type.in_(["harsh_brake", "rapid_acceleration"]), 1), else_=0)), 0)
    rows = (
        await db.execute(
            select(Trip.id, Trip.start_time, Trip.distance_meters, Trip.duration_seconds, Trip.max_g_force, Trip.driving_score, harsh)
            .outerjoin(Event, Event.trip_id == Trip.id)
            .where(Trip.user_id == user_id, Trip.deleted_at.is_(None), Trip.state == TripState.ended)
            .group_by(Trip.id)
        )
    ).all()
    drives = [
        DriveFacts(
            trip_id=row[0],
            start_time=row[1],
            distance_meters=float(row[2] or 0),
            duration_seconds=float(row[3] or 0),
            max_g=float(row[4]) if row[4] is not None else None,
            score=row[5],
            harsh_events=int(row[6] or 0),
        )
        for row in rows
    ]
    return overview(compute_achievements(drives, resolve_zone(tz), weekly_goal))
