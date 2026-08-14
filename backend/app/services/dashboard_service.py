from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import case, extract, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.event import Event
from app.models.enums import TripState
from app.models.trip import Trip
from app.models.vehicle import Vehicle
from app.models.vehicle_catalog import VehicleCompany, VehicleModel
from app.schemas.dashboard import (
    DashboardResponse,
    EventBreakdown,
    MetricSummary,
    RecentEventPage,
    RecentEventSummary,
    RecentTripSummary,
    TrendPoint,
    TrendSeries,
    VehicleDashboardSummary,
    VehicleStatsResponse,
    VehicleStatsSummary,
)
from app.services.trip_insight_service import RecurringEventGroup, TripInsight, build_recurring_insights
from app.services.trip_service import close_stale_trips


DASHBOARD_TREND_DAYS = 30
TREND_LOOKBACK_DAYS = {"day": DASHBOARD_TREND_DAYS, "week": 84, "month": 365}

# Buckets per window. A trend renders two of these back to back (previous vs current), so the query
# spans 2x this many buckets.
TREND_BUCKETS = {"day": 14, "week": 8, "month": 6}


def resolve_trend_lookback_days(granularity: str) -> int:
    return TREND_LOOKBACK_DAYS[granularity]


def truncate_to_bucket(moment: datetime, granularity: str) -> datetime:
    """Snap a moment to its bucket start, matching Postgres `date_trunc` in UTC.

    `date_trunc('week', ...)` snaps to Monday and `date_trunc('month', ...)` to the 1st, so the
    generated buckets have to agree exactly or the zero-fill lookup misses every real row.
    """
    aware = moment.astimezone(timezone.utc)
    midnight = aware.replace(hour=0, minute=0, second=0, microsecond=0)
    if granularity == "day":
        return midnight
    if granularity == "week":
        return midnight - timedelta(days=midnight.weekday())
    if granularity == "month":
        return midnight.replace(day=1)
    raise ValueError(f"Unsupported granularity: {granularity}")


def shift_bucket(bucket_start: datetime, granularity: str, steps: int) -> datetime:
    """Move `steps` buckets forward (negative moves back). Calendar-aware for months."""
    if granularity == "day":
        return bucket_start + timedelta(days=steps)
    if granularity == "week":
        return bucket_start + timedelta(weeks=steps)
    if granularity == "month":
        total_months = bucket_start.year * 12 + (bucket_start.month - 1) + steps
        return bucket_start.replace(year=total_months // 12, month=total_months % 12 + 1)
    raise ValueError(f"Unsupported granularity: {granularity}")


def build_bucket_starts(granularity: str, now: datetime, count: int) -> list[datetime]:
    """The `count` most recent bucket starts, oldest first, ending with the bucket `now` sits in."""
    latest = truncate_to_bucket(now, granularity)
    return [shift_bucket(latest, granularity, -offset) for offset in range(count - 1, -1, -1)]


def fill_trend_buckets(points: list[TrendPoint], bucket_starts: list[datetime]) -> list[TrendPoint]:
    """Emit one point per bucket, substituting a zero point where no trips fell in the bucket.

    The grouped query only returns buckets that had trips, so a client slicing the raw series gets
    "the last N buckets with driving" rather than the last N calendar buckets.
    """
    by_start = {point.bucket_start: point for point in points}
    return [by_start.get(start) or TrendPoint(bucket_start=start) for start in bucket_starts]


def split_trend_window(points: list[TrendPoint], bucket_count: int) -> tuple[list[TrendPoint], list[TrendPoint]]:
    """Split a 2N-bucket series into (previous N, current N)."""
    return points[:bucket_count], points[bucket_count:]


RECENT_TRIPS_LIMIT = 5
RECENT_EVENTS_LIMIT = 6
VEHICLE_SUMMARY_LIMIT = 10
RECURRING_INSIGHTS_DAYS = 30


def _to_float(value) -> float:
    if value is None:
        return 0.0
    return float(value)


def _to_int(value) -> int:
    if value is None:
        return 0
    return int(value)


def _vehicle_display_name_expr():
    return func.coalesce(Vehicle.name, func.concat(VehicleCompany.name, " ", VehicleModel.name))


def _join_vehicle_catalog(stmt):
    return stmt.join(VehicleModel, VehicleModel.id == Vehicle.model_id).join(
        VehicleCompany, VehicleCompany.id == VehicleModel.company_id
    )


async def _get_dashboard_summary(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    since: datetime | None = None,
) -> MetricSummary:
    vehicle_count_stmt = select(func.count()).select_from(Vehicle).where(
        Vehicle.user_id == user_id,
        Vehicle.deleted_at.is_(None),
    )
    vehicle_count = _to_int((await db.execute(vehicle_count_stmt)).scalar_one())

    trip_summary_stmt = select(
        func.count(Trip.id),
        func.sum(case((Trip.state != TripState.ended, 1), else_=0)),
        func.coalesce(func.sum(Trip.distance_meters), 0),
        func.coalesce(func.sum(Trip.duration_seconds), 0),
        func.coalesce(func.sum(Trip.fuel_used_liters), 0),
        func.coalesce(func.sum(Trip.cost_amount), 0),
        func.avg(Trip.driving_score),
    ).where(
        Trip.user_id == user_id,
        Trip.deleted_at.is_(None),
    )
    if since is not None:
        trip_summary_stmt = trip_summary_stmt.where(Trip.start_time >= since)
    trip_summary = (await db.execute(trip_summary_stmt)).one()

    return MetricSummary(
        total_vehicles=vehicle_count,
        total_trips=_to_int(trip_summary[0]),
        active_trips=_to_int(trip_summary[1]),
        total_distance_meters=_to_float(trip_summary[2]),
        total_duration_seconds=_to_int(trip_summary[3]),
        total_fuel_used_liters=_to_float(trip_summary[4]),
        total_fuel_cost_amount=_to_float(trip_summary[5]),
        avg_driving_score=float(trip_summary[6]) if trip_summary[6] is not None else None,
    )


async def _get_recent_events(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    limit: int = RECENT_EVENTS_LIMIT,
    offset: int = 0,
) -> tuple[list[RecentEventSummary], int]:
    total_stmt = (
        select(func.count(Event.id))
        .select_from(Event)
        .join(Trip, Trip.id == Event.trip_id)
        .join(Vehicle, Vehicle.id == Trip.vehicle_id)
        .where(
            Trip.user_id == user_id,
            Trip.deleted_at.is_(None),
            Vehicle.deleted_at.is_(None),
        )
    )
    total = _to_int((await db.execute(total_stmt)).scalar_one())

    stmt = (
        select(
            Event.id.label("event_id"),
            Event.trip_id,
            Trip.vehicle_id,
            _vehicle_display_name_expr().label("vehicle_name"),
            VehicleModel.image_url.label("vehicle_image_url"),
            Event.event_type,
            Event.occurred_at,
            Event.intensity,
        )
        .select_from(Event)
        .join(Trip, Trip.id == Event.trip_id)
        .join(Vehicle, Vehicle.id == Trip.vehicle_id)
    )
    stmt = _join_vehicle_catalog(stmt).where(
        Trip.user_id == user_id,
        Trip.deleted_at.is_(None),
        Vehicle.deleted_at.is_(None),
    ).order_by(Event.occurred_at.desc()).limit(limit).offset(offset)
    rows = (await db.execute(stmt)).all()
    items = [
        RecentEventSummary(
            event_id=row.event_id,
            trip_id=row.trip_id,
            vehicle_id=row.vehicle_id,
            vehicle_name=row.vehicle_name,
            vehicle_image_url=row.vehicle_image_url,
            event_type=row.event_type,
            occurred_at=row.occurred_at,
            intensity=float(row.intensity) if row.intensity is not None else None,
        )
        for row in rows
    ]
    return items, total


async def _get_trip_trend(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    vehicle_id: uuid.UUID | None = None,
    granularity: str = "day",
    days: int | None = None,
    since: datetime | None = None,
) -> list[TrendPoint]:
    if since is None:
        resolved_days = days if days is not None else resolve_trend_lookback_days(granularity)
        since = datetime.now(timezone.utc) - timedelta(days=resolved_days)
    stmt = (
        select(
            func.date_trunc(granularity, Trip.start_time).label("bucket_start"),
            func.count(Trip.id).label("trip_count"),
            func.coalesce(func.sum(Trip.distance_meters), 0).label("distance_meters"),
            func.coalesce(func.sum(Trip.fuel_used_liters), 0).label("fuel_used_liters"),
            func.coalesce(func.sum(Trip.cost_amount), 0).label("fuel_cost_amount"),
            func.avg(Trip.driving_score).label("avg_driving_score"),
        )
        .where(
            Trip.user_id == user_id,
            Trip.deleted_at.is_(None),
            Trip.start_time >= since,
        )
        .group_by("bucket_start")
        .order_by("bucket_start")
    )
    if vehicle_id is not None:
        stmt = stmt.where(Trip.vehicle_id == vehicle_id)

    rows = (await db.execute(stmt)).all()
    return [
        TrendPoint(
            bucket_start=row.bucket_start,
            trip_count=_to_int(row.trip_count),
            distance_meters=_to_float(row.distance_meters),
            fuel_used_liters=_to_float(row.fuel_used_liters),
            fuel_cost_amount=_to_float(row.fuel_cost_amount),
            avg_driving_score=float(row.avg_driving_score) if row.avg_driving_score is not None else None,
        )
        for row in rows
    ]


async def get_trend_series(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    granularity: str = "day",
    vehicle_id: uuid.UUID | None = None,
    now: datetime | None = None,
) -> TrendSeries:
    bucket_count = TREND_BUCKETS[granularity]
    resolved_now = now or datetime.now(timezone.utc)
    bucket_starts = build_bucket_starts(granularity, resolved_now, bucket_count * 2)
    rows = await _get_trip_trend(
        db,
        user_id=user_id,
        vehicle_id=vehicle_id,
        granularity=granularity,
        since=bucket_starts[0],
    )
    filled = fill_trend_buckets(rows, bucket_starts)
    previous, current = split_trend_window(filled, bucket_count)
    return TrendSeries(
        granularity=granularity,
        bucket_count=bucket_count,
        previous=previous,
        current=current,
    )


async def _get_fuel_trend(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    vehicle_id: uuid.UUID,
    days: int = DASHBOARD_TREND_DAYS,
) -> list[TrendPoint]:
    from app.models.fuel_log import FuelLog

    since = datetime.now(timezone.utc) - timedelta(days=days)
    stmt = (
        select(
            func.date_trunc("day", FuelLog.filled_at).label("bucket_start"),
            func.count(FuelLog.id).label("trip_count"),
            func.coalesce(func.sum(FuelLog.liters), 0).label("fuel_used_liters"),
            func.coalesce(func.sum(FuelLog.cost_amount), 0).label("fuel_cost_amount"),
        )
        .select_from(FuelLog)
        .join(Vehicle, Vehicle.id == FuelLog.vehicle_id)
        .where(
            FuelLog.vehicle_id == vehicle_id,
            Vehicle.user_id == user_id,
            Vehicle.deleted_at.is_(None),
            FuelLog.filled_at >= since,
        )
        .group_by("bucket_start")
        .order_by("bucket_start")
    )
    rows = (await db.execute(stmt)).all()
    return [
        TrendPoint(
            bucket_start=row.bucket_start,
            trip_count=_to_int(row.trip_count),
            fuel_used_liters=_to_float(row.fuel_used_liters),
            fuel_cost_amount=_to_float(row.fuel_cost_amount),
        )
        for row in rows
    ]


async def _get_event_breakdown(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    vehicle_id: uuid.UUID | None = None,
) -> EventBreakdown:
    stmt = (
        select(
            func.coalesce(func.sum(case((Event.event_type == "harsh_brake", 1), else_=0)), 0).label("harsh_brake_count"),
            func.coalesce(
                func.sum(case((Event.event_type == "rapid_acceleration", 1), else_=0)),
                0,
            ).label("rapid_acceleration_count"),
            func.coalesce(func.sum(case((Event.event_type == "overspeed", 1), else_=0)), 0).label("overspeed_count"),
            func.count(Event.id).label("total_events"),
        )
        .select_from(Event)
        .join(Trip, Trip.id == Event.trip_id)
        .where(
            Trip.user_id == user_id,
            Trip.deleted_at.is_(None),
        )
    )
    if vehicle_id is not None:
        stmt = stmt.where(Trip.vehicle_id == vehicle_id)

    row = (await db.execute(stmt)).one()
    return EventBreakdown(
        harsh_brake_count=_to_int(row.harsh_brake_count),
        rapid_acceleration_count=_to_int(row.rapid_acceleration_count),
        overspeed_count=_to_int(row.overspeed_count),
        total_events=_to_int(row.total_events),
    )


async def _get_recent_trips(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    vehicle_id: uuid.UUID | None = None,
    limit: int = RECENT_TRIPS_LIMIT,
) -> list[RecentTripSummary]:
    stmt = (
        select(
            Trip.id.label("trip_id"),
            Trip.vehicle_id,
            _vehicle_display_name_expr().label("vehicle_name"),
            VehicleModel.image_url.label("vehicle_image_url"),
            Trip.state,
            Trip.start_time,
            Trip.end_time,
            Trip.distance_meters,
            Trip.duration_seconds,
            Trip.driving_score,
            Trip.avg_speed_mps,
            Trip.max_speed_mps,
            Trip.start_address,
            Trip.end_address,
            func.count(Event.id).label("event_count"),
        )
        .join(Vehicle, Vehicle.id == Trip.vehicle_id)
    )
    stmt = (
        _join_vehicle_catalog(stmt)
        .outerjoin(Event, Event.trip_id == Trip.id)
        .where(
            Trip.user_id == user_id,
            Trip.deleted_at.is_(None),
            Vehicle.deleted_at.is_(None),
        )
        .group_by(
            Trip.id,
            Trip.vehicle_id,
            Vehicle.name,
            VehicleModel.name,
            VehicleModel.image_url,
            VehicleCompany.name,
            Trip.state,
            Trip.start_time,
            Trip.end_time,
            Trip.distance_meters,
            Trip.duration_seconds,
            Trip.driving_score,
            Trip.avg_speed_mps,
            Trip.max_speed_mps,
            Trip.start_address,
            Trip.end_address,
        )
        .order_by(Trip.start_time.desc())
        .limit(limit)
    )
    if vehicle_id is not None:
        stmt = stmt.where(Trip.vehicle_id == vehicle_id)

    rows = (await db.execute(stmt)).all()
    return [
        RecentTripSummary(
            trip_id=row.trip_id,
            vehicle_id=row.vehicle_id,
            vehicle_name=row.vehicle_name,
            vehicle_image_url=row.vehicle_image_url,
            state=row.state.value if hasattr(row.state, "value") else str(row.state),
            start_time=row.start_time,
            end_time=row.end_time,
            distance_meters=_to_float(row.distance_meters),
            duration_seconds=_to_int(row.duration_seconds),
            driving_score=row.driving_score,
            avg_speed_mps=float(row.avg_speed_mps) if row.avg_speed_mps is not None else None,
            max_speed_mps=float(row.max_speed_mps) if row.max_speed_mps is not None else None,
            start_address=row.start_address,
            end_address=row.end_address,
            event_count=_to_int(row.event_count),
        )
        for row in rows
    ]


async def _get_vehicle_summaries(db: AsyncSession, *, user_id: uuid.UUID) -> list[VehicleDashboardSummary]:
    stmt = (
        select(
            Vehicle.id.label("vehicle_id"),
            _vehicle_display_name_expr().label("vehicle_name"),
            VehicleModel.image_url.label("vehicle_image_url"),
            VehicleCompany.name.label("company_name"),
            VehicleModel.name.label("model_name"),
            Vehicle.name.label("nickname"),
            Vehicle.plate_number,
            Vehicle.fuel_type,
            Vehicle.mileage_baseline_km_per_l,
            func.count(Trip.id).label("trip_count"),
            func.coalesce(func.sum(Trip.distance_meters), 0).label("total_distance_meters"),
            func.coalesce(func.sum(Trip.fuel_used_liters), 0).label("total_fuel_used_liters"),
            func.avg(Trip.driving_score).label("avg_driving_score"),
            func.max(Trip.start_time).label("last_trip_at"),
        )
        .select_from(Vehicle)
    )
    stmt = (
        _join_vehicle_catalog(stmt)
        .outerjoin(Trip, (Trip.vehicle_id == Vehicle.id) & (Trip.deleted_at.is_(None)))
        .where(
            Vehicle.user_id == user_id,
            Vehicle.deleted_at.is_(None),
        )
        .group_by(
            Vehicle.id,
            Vehicle.name,
            VehicleModel.name,
            VehicleModel.image_url,
            VehicleCompany.name,
            Vehicle.plate_number,
            Vehicle.fuel_type,
            Vehicle.mileage_baseline_km_per_l,
        )
        .order_by(func.max(Trip.start_time).desc().nullslast(), Vehicle.created_at.desc())
        .limit(VEHICLE_SUMMARY_LIMIT)
    )

    rows = (await db.execute(stmt)).all()
    return [
            VehicleDashboardSummary(
                vehicle_id=row.vehicle_id,
                vehicle_name=row.vehicle_name,
                vehicle_image_url=row.vehicle_image_url,
                company_name=row.company_name,
                model_name=row.model_name,
                nickname=row.nickname,
                plate_number=row.plate_number,
                fuel_type=row.fuel_type.value if hasattr(row.fuel_type, "value") else str(row.fuel_type),
                mileage_baseline_km_per_l=float(row.mileage_baseline_km_per_l) if row.mileage_baseline_km_per_l is not None else None,
                trip_count=_to_int(row.trip_count),
                total_distance_meters=_to_float(row.total_distance_meters),
                total_fuel_used_liters=_to_float(row.total_fuel_used_liters),
            avg_driving_score=float(row.avg_driving_score) if row.avg_driving_score is not None else None,
            last_trip_at=row.last_trip_at,
        )
        for row in rows
    ]


async def _get_vehicle_overview(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    vehicle_id: uuid.UUID,
) -> VehicleStatsSummary | None:
    stmt = (
        select(
            Vehicle.id.label("vehicle_id"),
            _vehicle_display_name_expr().label("vehicle_name"),
            VehicleModel.image_url.label("vehicle_image_url"),
            Vehicle.fuel_type,
            func.count(Trip.id).label("trip_count"),
            func.coalesce(func.sum(case((Trip.state != TripState.ended, 1), else_=0)), 0).label("active_trip_count"),
            func.coalesce(func.sum(Trip.distance_meters), 0).label("total_distance_meters"),
            func.coalesce(func.sum(Trip.duration_seconds), 0).label("total_duration_seconds"),
            func.coalesce(func.sum(Trip.fuel_used_liters), 0).label("total_fuel_used_liters"),
            func.coalesce(func.sum(Trip.cost_amount), 0).label("total_fuel_cost_amount"),
            func.avg(Trip.driving_score).label("avg_driving_score"),
            func.max(Trip.start_time).label("last_trip_at"),
        )
        .select_from(Vehicle)
    )
    stmt = (
        _join_vehicle_catalog(stmt)
        .outerjoin(Trip, (Trip.vehicle_id == Vehicle.id) & (Trip.deleted_at.is_(None)))
        .where(
            Vehicle.id == vehicle_id,
            Vehicle.user_id == user_id,
            Vehicle.deleted_at.is_(None),
        )
        .group_by(Vehicle.id, Vehicle.name, VehicleModel.name, VehicleModel.image_url, VehicleCompany.name, Vehicle.fuel_type)
    )
    row = (await db.execute(stmt)).one_or_none()
    if row is None:
        return None

    return VehicleStatsSummary(
        vehicle_id=row.vehicle_id,
        vehicle_name=row.vehicle_name,
        vehicle_image_url=row.vehicle_image_url,
        fuel_type=row.fuel_type.value if hasattr(row.fuel_type, "value") else str(row.fuel_type),
        trip_count=_to_int(row.trip_count),
        active_trip_count=_to_int(row.active_trip_count),
        total_distance_meters=_to_float(row.total_distance_meters),
        total_duration_seconds=_to_int(row.total_duration_seconds),
        total_fuel_used_liters=_to_float(row.total_fuel_used_liters),
        total_fuel_cost_amount=_to_float(row.total_fuel_cost_amount),
        avg_driving_score=float(row.avg_driving_score) if row.avg_driving_score is not None else None,
        last_trip_at=row.last_trip_at,
    )


async def get_dashboard_data(db: AsyncSession, *, user_id: uuid.UUID) -> DashboardResponse:
    now = datetime.now(timezone.utc)
    # Retire abandoned trips before aggregating. The dashboard is the surface that reports an
    # "ongoing trip", so it must not report one whose client stopped sending points long ago. Cheap:
    # the query behind it is covered by trips_user_active_idx and commits only when it closed
    # something.
    await close_stale_trips(db, user_id=user_id, now=now)
    summary = await _get_dashboard_summary(db, user_id=user_id)
    week_summary = await _get_dashboard_summary(db, user_id=user_id, since=now - timedelta(days=7))
    today_summary = await _get_dashboard_summary(
        db,
        user_id=user_id,
        since=now.replace(hour=0, minute=0, second=0, microsecond=0),
    )
    # Flattened here for backwards compatibility: `DashboardResponse.trend` stays a single dense
    # daily series, and clients that want another granularity call /dashboard/trend.
    day_series = await get_trend_series(db, user_id=user_id, granularity="day", now=now)
    trend = day_series.previous + day_series.current
    events = await _get_event_breakdown(db, user_id=user_id)
    vehicles = await _get_vehicle_summaries(db, user_id=user_id)
    recent_trips = await _get_recent_trips(db, user_id=user_id)
    recent_events, _recent_events_total = await _get_recent_events(db, user_id=user_id)
    return DashboardResponse(
        summary=summary,
        week_summary=week_summary,
        today_summary=today_summary,
        trend=trend,
        events=events,
        vehicles=vehicles,
        recent_trips=recent_trips,
        recent_events=recent_events,
    )


async def get_recent_events_page(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    limit: int,
    offset: int,
) -> RecentEventPage:
    items, total = await _get_recent_events(db, user_id=user_id, limit=limit, offset=offset)
    return RecentEventPage(items=items, total=total, limit=limit, offset=offset)


_IST_HOUR_EXPR = extract("hour", Event.occurred_at + timedelta(hours=5, minutes=30))

_HOUR_BUCKET_EXPR = case(
    (_IST_HOUR_EXPR < 6, "night"),
    (_IST_HOUR_EXPR < 12, "morning"),
    (_IST_HOUR_EXPR < 18, "afternoon"),
    else_="evening",
)


async def get_recurring_insights_data(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    days: int = RECURRING_INSIGHTS_DAYS,
) -> list[TripInsight]:
    since = datetime.now(timezone.utc) - timedelta(days=days)
    stmt = (
        select(
            Event.event_type,
            _HOUR_BUCKET_EXPR.label("time_bucket"),
            func.count(Event.id).label("count"),
        )
        .select_from(Event)
        .join(Trip, Trip.id == Event.trip_id)
        .where(
            Trip.user_id == user_id,
            Trip.deleted_at.is_(None),
            Event.occurred_at >= since,
        )
        .group_by(Event.event_type, "time_bucket")
    )
    rows = (await db.execute(stmt)).all()
    groups = [
        RecurringEventGroup(event_type=row.event_type, time_bucket=row.time_bucket, count=_to_int(row.count))
        for row in rows
    ]
    return build_recurring_insights(groups)


async def get_vehicle_stats_data(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    vehicle_id: uuid.UUID,
    granularity: str = "day",
) -> VehicleStatsResponse | None:
    summary = await _get_vehicle_overview(db, user_id=user_id, vehicle_id=vehicle_id)
    if summary is None:
        return None

    trip_trend = await _get_trip_trend(db, user_id=user_id, vehicle_id=vehicle_id, granularity=granularity)
    fuel_trend = await _get_fuel_trend(db, user_id=user_id, vehicle_id=vehicle_id)
    events = await _get_event_breakdown(db, user_id=user_id, vehicle_id=vehicle_id)
    recent_trips = await _get_recent_trips(db, user_id=user_id, vehicle_id=vehicle_id)
    return VehicleStatsResponse(
        summary=summary,
        trip_trend=trip_trend,
        fuel_trend=fuel_trend,
        events=events,
        recent_trips=recent_trips,
    )
