"""The All Stats page: one period (and optionally one vehicle) summarised every way the page shows it."""
from __future__ import annotations

import uuid
from collections import Counter
from collections.abc import Iterable
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import Date, case, cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import TripState
from app.models.event import Event
from app.models.location_point import LocationPoint
from app.models.trip import Trip
from app.schemas.stats import (
    DriveShare,
    RecordTrip,
    SpeedDistributionBand,
    StatsOverview,
    StatsPeriod,
    StatsRecords,
    StatsStreaks,
    StatsSummary,
    StatsTrend,
    StatsTrendBucket,
    StatsEvents,
    StatsSpeeding,
    TimeAtSpeedBand,
    TopDay,
    VisitedPlace,
)
from app.services.home_stats_service import compute_streak, resolve_zone
from app.services.trip_service import close_stale_trips

# The trip page's bands (mobile `SPEED_BANDS`): 20 km/h wide, the last open-ended. The SQL below
# relies on that width, so change both together.
BAND_WIDTH_KMH = 20
SPEED_BAND_LABELS = ["0–20", "20–40", "40–60", "60–80", "80–100", "100+"]
STOPPED_KMH = 5
# Longer gaps between points are the phone pausing, not driving at the last speed.
MAX_GAP_SECONDS = 600
ALL_TIME_MONTHS = 24
# A custom range up to this many days gets a bar per day; a longer one, a bar per month.
MAX_DAY_BARS = 62
TOP_PLACES = 5
TOP_DAYS = 3
# Altitude must move this far from the last counted height before it counts: GPS altitude jitters.
ELEVATION_STEP_M = 3.0
PARTS_OF_DAY = [("Morning", 5, 12), ("Afternoon", 12, 17), ("Evening", 17, 21), ("Night", 21, 29)]
WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


def elevation_gain(altitudes: Iterable[float]) -> float:
    """Climb along one drive, counting a rise only once it beats the jitter step."""
    gain = 0.0
    ref: float | None = None
    for altitude in altitudes:
        if ref is None:
            ref = altitude
        elif abs(altitude - ref) >= ELEVATION_STEP_M:
            if altitude > ref:
                gain += altitude - ref
            ref = altitude
    return gain


def part_of_day(hour: int) -> str:
    """Morning 05–12, afternoon 12–17, evening 17–21, night 21–05."""
    h = hour if hour >= 5 else hour + 24
    return next(label for label, start, end in PARTS_OF_DAY if start <= h < end)


def drive_shares(drives: Iterable[tuple[datetime, float]], zone: ZoneInfo) -> tuple[list[DriveShare], list[DriveShare], list[DriveShare]]:
    """(by part of day, by weekday, by hour "00".."23"): drives and distance, every bucket present
    even when empty."""
    parts = {label: [0, 0.0] for label, _, _ in PARTS_OF_DAY}
    days = {label: [0, 0.0] for label in WEEKDAYS}
    hours = {f"{h:02d}": [0, 0.0] for h in range(24)}
    for start, meters in drives:
        local = start.astimezone(zone)
        for bucket in (parts[part_of_day(local.hour)], days[WEEKDAYS[local.weekday()]], hours[f"{local.hour:02d}"]):
            bucket[0] += 1
            bucket[1] += meters
    as_list = lambda d: [DriveShare(label=k, trips=v[0], distance_meters=v[1]) for k, v in d.items()]  # noqa: E731
    return as_list(parts), as_list(days), as_list(hours)


def band_index(kmh: float) -> int:
    return min(max(int(kmh // BAND_WIDTH_KMH), 0), len(SPEED_BAND_LABELS) - 1)


def period_start(period: StatsPeriod, now_local: datetime) -> datetime | None:
    """Start of the period in the user's zone: Monday, the 1st, 1 January, or None for all time."""
    midnight = now_local.replace(hour=0, minute=0, second=0, microsecond=0)
    if period == "week":
        return midnight - timedelta(days=now_local.weekday())
    if period == "month":
        return midnight.replace(day=1)
    if period == "year":
        return midnight.replace(month=1, day=1)
    return None


def _add_month(d: date, months: int = 1) -> date:
    index = d.year * 12 + d.month - 1 + months
    return date(index // 12, index % 12 + 1, 1)


def custom_granularity(start: date, end: date) -> str:
    return "day" if (end - start).days < MAX_DAY_BARS else "month"


def trend_bucket_starts(
    period: StatsPeriod,
    today: date,
    first_drive: date | None,
    custom: tuple[date, date] | None = None,
) -> list[date]:
    """Bars for the trend chart: the week's 7 days, the month's days so far, the year's 12 months,
    the months since the first drive (the latest 24), or a custom range's days (or months)."""
    if period == "custom" and custom is not None:
        start, end = custom
        if custom_granularity(start, end) == "day":
            return [start + timedelta(days=i) for i in range((end - start).days + 1)]
        months, month = [], start.replace(day=1)
        while month <= end:
            months.append(month)
            month = _add_month(month)
        return months
    if period == "week":
        monday = today - timedelta(days=today.weekday())
        return [monday + timedelta(days=i) for i in range(7)]
    if period == "month":
        return [today.replace(day=d) for d in range(1, today.day + 1)]
    if period == "year":
        return [date(today.year, m, 1) for m in range(1, 13)]
    current = today.replace(day=1)
    start = (first_drive or today).replace(day=1)
    earliest = _add_month(current, -(ALL_TIME_MONTHS - 1))
    month = max(start, earliest)
    months = []
    while month <= current:
        months.append(month)
        month = _add_month(month)
    return months


def best_streak(drive_days: Iterable[date]) -> int:
    """Longest run of consecutive days with a drive."""
    days = sorted(set(drive_days))
    best = run = 0
    previous: date | None = None
    for day in days:
        run = run + 1 if previous is not None and day - previous == timedelta(days=1) else 1
        best = max(best, run)
        previous = day
    return best


def city_name(address: str | None) -> str | None:
    """The last part of an address, as the Logbook titles a trip."""
    if not address:
        return None
    name = address.split(",")[-1].strip()
    return name or None


def top_places(addresses: Iterable[tuple[str | None, int]], limit: int = TOP_PLACES) -> list[VisitedPlace]:
    counts: Counter[str] = Counter()
    for address, visits in addresses:
        name = city_name(address)
        if name:
            counts[name] += visits
    # Ties fall back to the name, so the order is stable between loads.
    ranked = sorted(counts.items(), key=lambda item: (-item[1], item[0]))
    return [VisitedPlace(name=name, visits=visits) for name, visits in ranked[:limit]]


def _f(value) -> float | None:
    return float(value) if value is not None else None


async def get_stats_overview(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    period: StatsPeriod,
    tz: str | None,
    vehicle_id: uuid.UUID | None = None,
    start: date | None = None,
    end: date | None = None,
    over_kmh: float = 100.0,
    now: datetime | None = None,
) -> StatsOverview:
    """`start` and `end` (inclusive local days) are required for, and only used by, `custom`."""
    effective_now = now or datetime.now(timezone.utc)
    await close_stale_trips(db, user_id=user_id, now=effective_now)
    zone: ZoneInfo = resolve_zone(tz)
    now_local = effective_now.astimezone(zone)
    custom = (start, end) if period == "custom" and start is not None and end is not None else None
    if custom:
        since = datetime.combine(custom[0], datetime.min.time(), zone)
        until = datetime.combine(custom[1] + timedelta(days=1), datetime.min.time(), zone)
    else:
        since, until = period_start(period, now_local), None

    owned = [Trip.user_id == user_id, Trip.deleted_at.is_(None), Trip.state == TripState.ended]
    if vehicle_id is not None:
        owned.append(Trip.vehicle_id == vehicle_id)
    scoped = [*owned, *([Trip.start_time >= since] if since is not None else []), *([Trip.start_time < until] if until is not None else [])]
    moving_expr = func.greatest(Trip.duration_seconds - Trip.idle_time_seconds, 0)
    local_start = func.timezone(zone.key, Trip.start_time)

    totals = (
        await db.execute(
            select(
                func.count(Trip.id),
                func.coalesce(func.sum(Trip.distance_meters), 0),
                func.coalesce(func.sum(Trip.duration_seconds), 0),
                func.coalesce(func.sum(func.least(Trip.idle_time_seconds, Trip.duration_seconds)), 0),
                func.max(Trip.distance_meters),
                func.min(Trip.start_time),
            ).where(*scoped)
        )
    ).one()
    count = int(totals[0] or 0)
    distance = float(totals[1] or 0)
    duration = int(totals[2] or 0)
    idle = int(totals[3] or 0)
    moving = max(duration - idle, 0)
    summary = StatsSummary(
        distance_meters=distance,
        trip_count=count,
        avg_distance_meters=distance / count if count else None,
        duration_seconds=duration,
        avg_duration_seconds=duration / count if count else None,
        avg_speed_mps=distance / moving if moving > 0 and distance > 0 else None,
        moving_seconds=moving,
        idle_seconds=idle,
        longest_distance_meters=_f(totals[4]) if count else None,
    )

    # Trend: one bar per local day (week, month) or month (year, all).
    if custom:
        granularity = custom_granularity(*custom)
    else:
        granularity = "day" if period in ("week", "month") else "month"
    first_drive = totals[5].astimezone(zone).date() if totals[5] is not None else None
    starts = trend_bucket_starts(period, now_local.date(), first_drive, custom)
    bucket = cast(func.date_trunc(granularity, local_start), Date)
    trend_rows = (
        await db.execute(
            select(
                bucket,
                func.sum(Trip.distance_meters),
                func.sum(Trip.duration_seconds),
                func.sum(moving_expr),
                func.max(Trip.max_speed_mps),
                func.max(Trip.max_g_force),
                func.avg(Trip.driving_score),
            )
            .where(
                *owned,
                Trip.start_time >= datetime.combine(starts[0], datetime.min.time(), zone),
                *([Trip.start_time < until] if until is not None else []),
            )
            .group_by(bucket)
        )
    ).all()
    by_start = {row[0]: row for row in trend_rows}
    buckets = []
    for start in starts:
        row = by_start.get(start)
        dist = float(row[1] or 0) if row else 0.0
        moved = int(row[3] or 0) if row else 0
        buckets.append(
            StatsTrendBucket(
                start=start,
                distance_meters=dist,
                duration_seconds=int(row[2] or 0) if row else 0,
                avg_speed_mps=dist / moved if moved > 0 and dist > 0 else None,
                max_speed_mps=_f(row[4]) if row else None,
                max_g=_f(row[5]) if row else None,
                avg_score=_f(row[6]) if row else None,
            )
        )

    band = func.least(func.floor(Trip.max_speed_mps * 3.6 / BAND_WIDTH_KMH), len(SPEED_BAND_LABELS) - 1)
    distribution_rows = (
        await db.execute(select(band, func.count()).where(*scoped, Trip.max_speed_mps > 0).group_by(band))
    ).all()
    trips_by_band = {int(row[0]): int(row[1]) for row in distribution_rows}

    # Time at speed: each pair of consecutive points is an interval driven at the earlier point's speed.
    window = {"partition_by": LocationPoint.trip_id, "order_by": LocationPoint.recorded_at}
    intervals = (
        select(
            func.extract("epoch", LocationPoint.recorded_at - func.lag(LocationPoint.recorded_at).over(**window)).label("dt"),
            func.lag(LocationPoint.speed_mps).over(**window).label("v"),
        )
        .join(Trip, Trip.id == LocationPoint.trip_id)
        .where(*scoped)
        .subquery()
    )
    point_band = func.least(func.floor(intervals.c.v * 3.6 / BAND_WIDTH_KMH), len(SPEED_BAND_LABELS) - 1)
    time_rows = (
        await db.execute(
            select(point_band, func.sum(intervals.c.dt), func.sum(intervals.c.dt * intervals.c.v))
            .where(intervals.c.dt > 0, intervals.c.dt <= MAX_GAP_SECONDS, intervals.c.v * 3.6 >= STOPPED_KMH)
            .group_by(point_band)
        )
    ).all()
    time_by_band = {int(row[0]): (float(row[1] or 0), float(row[2] or 0)) for row in time_rows}

    # Speeding: moving time above the user's limit (the Settings speed alert), from the same intervals.
    over = (
        await db.execute(
            select(
                func.coalesce(func.sum(case((intervals.c.v * 3.6 > over_kmh, intervals.c.dt), else_=0)), 0),
                func.coalesce(func.sum(intervals.c.dt), 0),
            ).where(intervals.c.dt > 0, intervals.c.dt <= MAX_GAP_SECONDS, intervals.c.v * 3.6 >= STOPPED_KMH)
        )
    ).one()
    over_seconds, moving_gps = float(over[0] or 0), float(over[1] or 0)
    speeding = StatsSpeeding(limit_kmh=over_kmh, seconds=over_seconds, share=over_seconds / moving_gps if moving_gps > 0 else None)

    event_rows = (
        await db.execute(select(Event.event_type, func.count()).join(Trip, Trip.id == Event.trip_id).where(*scoped).group_by(Event.event_type))
    ).all()
    counts = {row[0]: int(row[1]) for row in event_rows}
    flagged = counts.get("harsh_brake", 0) + counts.get("rapid_acceleration", 0) + counts.get("overspeed", 0) + counts.get("sharp_turn", 0)
    events = StatsEvents(
        harsh_brake=counts.get("harsh_brake", 0),
        rapid_acceleration=counts.get("rapid_acceleration", 0),
        overspeed=counts.get("overspeed", 0),
        sharp_turn=counts.get("sharp_turn", 0),
        per_100km=flagged / (distance / 100_000) if distance > 0 else None,
    )

    altitude_rows = (
        await db.execute(
            select(LocationPoint.trip_id, LocationPoint.altitude_m)
            .join(Trip, Trip.id == LocationPoint.trip_id)
            .where(*scoped, LocationPoint.altitude_m.is_not(None), LocationPoint.altitude_m != 0)
            .order_by(LocationPoint.trip_id, LocationPoint.recorded_at)
        )
    ).all()
    per_trip: dict[uuid.UUID, list[float]] = {}
    for trip_id, altitude in altitude_rows:
        per_trip.setdefault(trip_id, []).append(float(altitude))
    climb = sum(elevation_gain(alts) for alts in per_trip.values()) if per_trip else None

    share_rows = (await db.execute(select(Trip.start_time, Trip.distance_meters).where(*scoped))).all()
    time_of_day, weekdays, hours = drive_shares(((row[0], float(row[1] or 0)) for row in share_rows), zone)

    async def record(column) -> RecordTrip | None:
        row = (
            await db.execute(
                select(Trip.id, column, Trip.start_time, Trip.end_address)
                .where(*scoped, column.is_not(None), column > 0)
                .order_by(column.desc(), Trip.start_time.desc())
                .limit(1)
            )
        ).first()
        return RecordTrip(trip_id=row[0], value=float(row[1]), start_time=row[2], end_address=row[3]) if row else None

    records = StatsRecords(
        top_speed=await record(Trip.max_speed_mps),
        longest_distance=await record(Trip.distance_meters),
        longest_duration=await record(Trip.duration_seconds),
        best_score=await record(Trip.driving_score),
    )

    local_day = cast(local_start, Date)
    day_distance = func.sum(Trip.distance_meters)
    top_day_rows = (
        await db.execute(
            select(local_day, day_distance, func.count(Trip.id))
            .where(*scoped)
            .group_by(local_day)
            .order_by(day_distance.desc())
            .limit(TOP_DAYS)
        )
    ).all()

    # Streaks are all-time (for the chosen vehicle): a streak inside "this week" means little.
    drive_days = (await db.execute(select(local_day).where(*owned).distinct())).scalars().all()

    place_rows = (
        await db.execute(select(Trip.end_address, func.count()).where(*scoped, Trip.end_address.is_not(None)).group_by(Trip.end_address))
    ).all()

    return StatsOverview(
        period=period,
        since=since,
        until=until,
        summary=summary,
        trend=StatsTrend(granularity=granularity, buckets=buckets),
        speed_distribution=[SpeedDistributionBand(label=label, trips=trips_by_band.get(i, 0)) for i, label in enumerate(SPEED_BAND_LABELS)],
        time_at_speed=[
            TimeAtSpeedBand(label=label, seconds=time_by_band.get(i, (0.0, 0.0))[0], meters=time_by_band.get(i, (0.0, 0.0))[1])
            for i, label in enumerate(SPEED_BAND_LABELS)
        ],
        records=records,
        top_days=[TopDay(date=row[0], distance_meters=float(row[1] or 0), trip_count=int(row[2])) for row in top_day_rows],
        streaks=StatsStreaks(current_days=compute_streak(drive_days, now_local.date()), best_days=best_streak(drive_days)),
        places=top_places((row[0], int(row[1])) for row in place_rows),
        events=events,
        speeding=speeding,
        elevation_gain_m=climb,
        time_of_day=time_of_day,
        weekdays=weekdays,
        hours=hours,
    )
