from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.event import Event
from app.models.enums import TripState
from app.models.trip import Trip
from app.models.vehicle import Vehicle
from app.schemas.dashboard import (
    DashboardResponse,
    EventBreakdown,
    MetricSummary,
    RecentEventPage,
    RecentEventSummary,
    RecentTripSummary,
    TrendPoint,
    VehicleDashboardSummary,
    VehicleStatsResponse,
    VehicleStatsSummary,
)


DASHBOARD_TREND_DAYS = 30
RECENT_TRIPS_LIMIT = 5
RECENT_EVENTS_LIMIT = 6
VEHICLE_SUMMARY_LIMIT = 10


def _to_float(value) -> float:
    if value is None:
        return 0.0
    return float(value)


def _to_int(value) -> int:
    if value is None:
        return 0
    return int(value)


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
            Vehicle.name.label("vehicle_name"),
            Event.event_type,
            Event.occurred_at,
            Event.intensity,
        )
        .select_from(Event)
        .join(Trip, Trip.id == Event.trip_id)
        .join(Vehicle, Vehicle.id == Trip.vehicle_id)
        .where(
            Trip.user_id == user_id,
            Trip.deleted_at.is_(None),
            Vehicle.deleted_at.is_(None),
        )
        .order_by(Event.occurred_at.desc())
        .limit(limit)
        .offset(offset)
    )
    rows = (await db.execute(stmt)).all()
    items = [
        RecentEventSummary(
            event_id=row.event_id,
            trip_id=row.trip_id,
            vehicle_id=row.vehicle_id,
            vehicle_name=row.vehicle_name,
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
    days: int = DASHBOARD_TREND_DAYS,
) -> list[TrendPoint]:
    since = datetime.now(timezone.utc) - timedelta(days=days)
    stmt = (
        select(
            func.date_trunc("day", Trip.start_time).label("bucket_start"),
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
            Vehicle.name.label("vehicle_name"),
            Trip.state,
            Trip.start_time,
            Trip.end_time,
            Trip.distance_meters,
            Trip.duration_seconds,
            Trip.driving_score,
            func.count(Event.id).label("event_count"),
        )
        .join(Vehicle, Vehicle.id == Trip.vehicle_id)
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
            Trip.state,
            Trip.start_time,
            Trip.end_time,
            Trip.distance_meters,
            Trip.duration_seconds,
            Trip.driving_score,
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
            state=row.state.value if hasattr(row.state, "value") else str(row.state),
            start_time=row.start_time,
            end_time=row.end_time,
            distance_meters=_to_float(row.distance_meters),
            duration_seconds=_to_int(row.duration_seconds),
            driving_score=row.driving_score,
            event_count=_to_int(row.event_count),
        )
        for row in rows
    ]


async def _get_vehicle_summaries(db: AsyncSession, *, user_id: uuid.UUID) -> list[VehicleDashboardSummary]:
    stmt = (
        select(
            Vehicle.id.label("vehicle_id"),
            Vehicle.name.label("vehicle_name"),
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
        .outerjoin(Trip, (Trip.vehicle_id == Vehicle.id) & (Trip.deleted_at.is_(None)))
        .where(
            Vehicle.user_id == user_id,
            Vehicle.deleted_at.is_(None),
        )
        .group_by(Vehicle.id, Vehicle.name, Vehicle.plate_number, Vehicle.fuel_type, Vehicle.mileage_baseline_km_per_l)
        .order_by(func.max(Trip.start_time).desc().nullslast(), Vehicle.created_at.desc())
        .limit(VEHICLE_SUMMARY_LIMIT)
    )

    rows = (await db.execute(stmt)).all()
    return [
            VehicleDashboardSummary(
                vehicle_id=row.vehicle_id,
                vehicle_name=row.vehicle_name,
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
            Vehicle.name.label("vehicle_name"),
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
        .outerjoin(Trip, (Trip.vehicle_id == Vehicle.id) & (Trip.deleted_at.is_(None)))
        .where(
            Vehicle.id == vehicle_id,
            Vehicle.user_id == user_id,
            Vehicle.deleted_at.is_(None),
        )
        .group_by(Vehicle.id, Vehicle.name, Vehicle.fuel_type)
    )
    row = (await db.execute(stmt)).one_or_none()
    if row is None:
        return None

    return VehicleStatsSummary(
        vehicle_id=row.vehicle_id,
        vehicle_name=row.vehicle_name,
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
    summary = await _get_dashboard_summary(db, user_id=user_id)
    week_summary = await _get_dashboard_summary(db, user_id=user_id, since=now - timedelta(days=7))
    today_summary = await _get_dashboard_summary(
        db,
        user_id=user_id,
        since=now.replace(hour=0, minute=0, second=0, microsecond=0),
    )
    trend = await _get_trip_trend(db, user_id=user_id)
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


async def get_vehicle_stats_data(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    vehicle_id: uuid.UUID,
) -> VehicleStatsResponse | None:
    summary = await _get_vehicle_overview(db, user_id=user_id, vehicle_id=vehicle_id)
    if summary is None:
        return None

    trip_trend = await _get_trip_trend(db, user_id=user_id, vehicle_id=vehicle_id)
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
