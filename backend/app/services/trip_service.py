from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.event import Event
from app.models.enums import TripState
from app.models.location_point import LocationPoint
from app.models.trip import Trip
from app.models.vehicle import Vehicle
from app.models.vehicle_catalog import VehicleCompany, VehicleModel
from app.services.driving_score_service import update_trip_driving_score


#: A trip whose newest location point is older than this is abandoned, not ongoing. The client
#: auto-ends after 180s of idle, but only while the live screen stays mounted — this is the
#: server-side backstop for trips whose client went away (navigated off, killed, offline), and it is
#: deliberately far more lenient than 180s so a normal sync gap never closes a live trip.
STALE_TRIP_IDLE_SECONDS = 15 * 60


def _as_utc(value: datetime) -> datetime:
    """Treat naive timestamps as UTC so comparisons against an aware `now` cannot raise."""
    return value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)


def resolve_stale_trip_end(
    *,
    start_time: datetime,
    last_point_at: datetime | None,
    now: datetime,
    idle_seconds: int = STALE_TRIP_IDLE_SECONDS,
) -> datetime | None:
    """When a non-ended trip is abandoned, return the time it should be closed at.

    Returns ``None`` while the trip still counts as live. A trip that never recorded a point is
    measured from its own start time, which is what makes an auto-started trip that never moved
    eventually close instead of hanging open forever.
    """
    reference = _as_utc(last_point_at or start_time)
    if (_as_utc(now) - reference).total_seconds() <= idle_seconds:
        return None
    return reference


def _vehicle_display_name_expr():
    return func.coalesce(Vehicle.name, func.concat(VehicleCompany.name, " ", VehicleModel.name))


async def list_trips(db: AsyncSession, *, user_id: uuid.UUID, vehicle_id: uuid.UUID | None = None) -> list[Trip]:
    stmt = select(Trip).where(Trip.user_id == user_id, Trip.deleted_at.is_(None)).order_by(Trip.start_time.desc())
    if vehicle_id is not None:
        stmt = stmt.where(Trip.vehicle_id == vehicle_id)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def list_trip_summaries(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    vehicle_id: uuid.UUID | None = None,
    start_time_gte: datetime | None = None,
    start_time_lte: datetime | None = None,
    min_score: int | None = None,
    search: str | None = None,
    limit: int = 50,
    offset: int = 0,
):
    filters = [
        Trip.user_id == user_id,
        Trip.deleted_at.is_(None),
        Vehicle.deleted_at.is_(None),
    ]
    if vehicle_id is not None:
        filters.append(Trip.vehicle_id == vehicle_id)
    if start_time_gte is not None:
        filters.append(Trip.start_time >= start_time_gte)
    if start_time_lte is not None:
        filters.append(Trip.start_time <= start_time_lte)
    if min_score is not None:
        filters.append(Trip.driving_score >= min_score)
    if search:
        pattern = f"%{search.strip()}%"
        filters.append(
            or_(
                Vehicle.name.ilike(pattern),
                Vehicle.plate_number.ilike(pattern),
                VehicleModel.name.ilike(pattern),
                VehicleCompany.name.ilike(pattern),
            )
        )

    base_stmt = (
        select(func.count())
        .select_from(Trip)
        .join(Vehicle, Vehicle.id == Trip.vehicle_id)
        .join(VehicleModel, VehicleModel.id == Vehicle.model_id)
        .join(VehicleCompany, VehicleCompany.id == VehicleModel.company_id)
        .where(*filters)
    )
    total = int((await db.execute(base_stmt)).scalar_one() or 0)

    stmt = (
        select(
            Trip.id,
            Trip.user_id,
            Trip.vehicle_id,
            Trip.state,
            Trip.start_time,
            Trip.end_time,
            Trip.distance_meters,
            Trip.duration_seconds,
            Trip.created_at,
            Trip.driving_score,
            Trip.avg_speed_mps,
            _vehicle_display_name_expr().label("vehicle_name"),
            VehicleModel.image_url.label("vehicle_image_url"),
            func.count(Event.id).label("event_count"),
        )
        .join(Vehicle, Vehicle.id == Trip.vehicle_id)
        .join(VehicleModel, VehicleModel.id == Vehicle.model_id)
        .join(VehicleCompany, VehicleCompany.id == VehicleModel.company_id)
        .outerjoin(Event, Event.trip_id == Trip.id)
        .where(*filters)
        .group_by(
            Trip.id,
            Trip.user_id,
            Trip.vehicle_id,
            Trip.state,
            Trip.start_time,
            Trip.end_time,
            Trip.distance_meters,
            Trip.duration_seconds,
            Trip.created_at,
            Trip.driving_score,
            Trip.avg_speed_mps,
            Vehicle.name,
            VehicleModel.name,
            VehicleModel.image_url,
            VehicleCompany.name,
        )
        .order_by(Trip.start_time.desc())
        .limit(limit)
        .offset(offset)
    )

    result = await db.execute(stmt)
    return result.all(), total


async def get_trip_detail(db: AsyncSession, *, user_id: uuid.UUID, trip_id: uuid.UUID) -> Trip | None:
    result = await db.execute(
        select(Trip)
        .options(
            selectinload(Trip.vehicle).selectinload(Vehicle.model).selectinload(VehicleModel.company),
            selectinload(Trip.location_points),
            selectinload(Trip.events),
        )
        .where(
            Trip.id == trip_id,
            Trip.user_id == user_id,
            Trip.deleted_at.is_(None),
        )
    )
    trip = result.scalar_one_or_none()
    if trip is None:
        return None

    trip.location_points.sort(key=lambda point: (point.recorded_at, point.id))
    trip.events.sort(key=lambda event: event.occurred_at, reverse=True)
    return trip


async def _ensure_vehicle_owned(db: AsyncSession, *, user_id: uuid.UUID, vehicle_id: uuid.UUID) -> None:
    result = await db.execute(
        select(Vehicle.id).where(Vehicle.id == vehicle_id, Vehicle.user_id == user_id, Vehicle.deleted_at.is_(None))
    )
    if result.scalar_one_or_none() is None:
        raise ValueError("Vehicle not found")


def open_trips_with_last_point_stmt(*, user_id: uuid.UUID, vehicle_id: uuid.UUID | None = None):
    """Select every non-ended trip for the user with the timestamp of its newest location point."""
    last_point_at = (
        select(LocationPoint.trip_id, func.max(LocationPoint.recorded_at).label("last_point_at"))
        .group_by(LocationPoint.trip_id)
        .subquery()
    )
    stmt = (
        select(Trip, last_point_at.c.last_point_at)
        .outerjoin(last_point_at, last_point_at.c.trip_id == Trip.id)
        .where(
            Trip.user_id == user_id,
            Trip.deleted_at.is_(None),
            Trip.state != TripState.ended,
        )
    )
    if vehicle_id is not None:
        stmt = stmt.where(Trip.vehicle_id == vehicle_id)
    return stmt


async def _open_trips_with_last_point(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    vehicle_id: uuid.UUID | None = None,
) -> list[tuple[Trip, datetime | None]]:
    result = await db.execute(open_trips_with_last_point_stmt(user_id=user_id, vehicle_id=vehicle_id))
    return [(row[0], row[1]) for row in result.all()]


async def _close_trip(db: AsyncSession, trip: Trip, *, end_time: datetime) -> Trip:
    """Mark a trip ended. Shared by the normal end call and the abandoned-trip backstop."""
    trip.end_time = end_time
    trip.state = TripState.ended
    trip.duration_seconds = max(0, int((_as_utc(end_time) - _as_utc(trip.start_time)).total_seconds()))
    return await update_trip_driving_score(db, trip)


async def close_stale_trips(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    now: datetime | None = None,
) -> int:
    """Close trips whose client went away, and return how many were closed.

    Without this a trip is only ever ended by the live screen that started it, so navigating away,
    killing the app, or losing the network mid-trip leaves it open forever — and every dashboard read
    afterwards reports an ongoing trip that nobody is driving.
    """
    effective_now = now or datetime.now(timezone.utc)
    closed = 0

    for trip, last_point_at in await _open_trips_with_last_point(db, user_id=user_id):
        end_time = resolve_stale_trip_end(
            start_time=trip.start_time,
            last_point_at=last_point_at,
            now=effective_now,
        )
        if end_time is None:
            continue
        await _close_trip(db, trip, end_time=end_time)
        closed += 1

    if closed:
        await db.commit()

    return closed


async def start_trip(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    vehicle_id: uuid.UUID,
    start_time: datetime | None,
) -> Trip:
    await _ensure_vehicle_owned(db, user_id=user_id, vehicle_id=vehicle_id)

    # Close anything still open on this vehicle first. `end_trip` only ever resolves the newest
    # non-ended trip, so without this an abandoned trip becomes permanently unreachable and keeps
    # reading as ongoing for the life of the account.
    for trip, last_point_at in await _open_trips_with_last_point(db, user_id=user_id, vehicle_id=vehicle_id):
        await _close_trip(db, trip, end_time=_as_utc(last_point_at or trip.start_time))

    effective_start_time = start_time or datetime.now(timezone.utc)
    trip = Trip(user_id=user_id, vehicle_id=vehicle_id, state=TripState.started, start_time=effective_start_time)
    db.add(trip)
    await db.commit()
    await db.refresh(trip)
    return trip


async def end_trip(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    vehicle_id: uuid.UUID,
    end_time: datetime | None,
    distance_meters: float | None,
    duration_seconds: int | None,
) -> Trip:
    await _ensure_vehicle_owned(db, user_id=user_id, vehicle_id=vehicle_id)

    result = await db.execute(
        select(Trip)
        .where(
            Trip.user_id == user_id,
            Trip.vehicle_id == vehicle_id,
            Trip.deleted_at.is_(None),
            Trip.state != TripState.ended,
            Trip.end_time.is_(None),
        )
        .order_by(Trip.start_time.desc())
        .limit(1)
    )
    trip = result.scalar_one_or_none()
    if trip is None:
        raise ValueError("No active trip for vehicle")

    effective_end_time = end_time or datetime.now(timezone.utc)
    if effective_end_time < trip.start_time:
        raise ValueError("end_time must be >= start_time")

    if distance_meters is not None:
        trip.distance_meters = distance_meters
    trip = await _close_trip(db, trip, end_time=effective_end_time)
    if duration_seconds is not None:
        trip.duration_seconds = duration_seconds
    await db.commit()
    await db.refresh(trip)
    return trip
