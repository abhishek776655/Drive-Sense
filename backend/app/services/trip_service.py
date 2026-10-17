from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.event import Event
from app.models.enums import TripState
from app.models.location_point import LocationPoint
from app.models.trip import Trip
from app.models.vehicle import Vehicle
from app.models.vehicle_catalog import VehicleCompany, VehicleModel
from app.services.g_force_service import estimate_max_g_from_speeds
from app.services.turn_detection_service import detect_turns
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


TRIP_SORTS = ("newest", "oldest", "longest", "fastest", "best", "worst")


def trip_sort_order(sort: str) -> list:
    """Order clauses for the Logbook sort chip; ties always fall back to newest first."""
    newest = Trip.start_time.desc()
    orders = {
        "newest": [newest],
        "oldest": [Trip.start_time.asc()],
        "longest": [Trip.distance_meters.desc(), newest],
        "fastest": [Trip.max_speed_mps.desc().nulls_last(), newest],
        "best": [Trip.driving_score.desc().nulls_last(), newest],
        "worst": [Trip.driving_score.asc().nulls_last(), newest],
    }
    return orders.get(sort, orders["newest"])


def _trip_list_filters(
    *,
    user_id: uuid.UUID,
    vehicle_id: uuid.UUID | None = None,
    start_time_gte: datetime | None = None,
    start_time_lte: datetime | None = None,
    min_score: int | None = None,
    search: str | None = None,
) -> list:
    """Filters shared by the Logbook list, its totals and its route map."""
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
                Trip.start_address.ilike(pattern),
                Trip.end_address.ilike(pattern),
            )
        )
    return filters


def thin_route(points: list[tuple[float, float]], max_points: int = 40) -> list[tuple[float, float]]:
    """At most `max_points`, evenly spaced, first and last kept: enough to draw the shape."""
    if len(points) <= max_points or max_points < 2:
        return list(points)
    step = (len(points) - 1) / (max_points - 1)
    return [points[round(i * step)] for i in range(max_points)]


async def list_trip_routes(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    vehicle_id: uuid.UUID | None = None,
    start_time_gte: datetime | None = None,
    start_time_lte: datetime | None = None,
    min_score: int | None = None,
    search: str | None = None,
    limit: int = 30,
) -> list[dict]:
    """Route lines for the Logbook map: newest trips first, each thinned, trips without a route skipped."""
    filters = _trip_list_filters(
        user_id=user_id,
        vehicle_id=vehicle_id,
        start_time_gte=start_time_gte,
        start_time_lte=start_time_lte,
        min_score=min_score,
        search=search,
    )
    trips = (
        await db.execute(
            select(Trip.id, Trip.start_time, Trip.distance_meters, Trip.duration_seconds, Trip.max_speed_mps, Trip.start_address, Trip.end_address)
            .join(Vehicle, Vehicle.id == Trip.vehicle_id)
            .join(VehicleModel, VehicleModel.id == Vehicle.model_id)
            .join(VehicleCompany, VehicleCompany.id == VehicleModel.company_id)
            .where(*filters)
            .order_by(Trip.start_time.desc())
            .limit(limit)
        )
    ).all()
    if not trips:
        return []
    rows = (
        await db.execute(
            select(LocationPoint.trip_id, LocationPoint.latitude, LocationPoint.longitude)
            .where(LocationPoint.trip_id.in_([t.id for t in trips]))
            .order_by(LocationPoint.trip_id, LocationPoint.recorded_at)
        )
    ).all()
    by_trip: dict[uuid.UUID, list[tuple[float, float]]] = {}
    for row in rows:
        by_trip.setdefault(row.trip_id, []).append((float(row.latitude), float(row.longitude)))
    return [
        {
            "trip_id": t.id,
            "start_time": t.start_time,
            "distance_meters": float(t.distance_meters or 0),
            "duration_seconds": int(t.duration_seconds or 0),
            "max_speed_mps": float(t.max_speed_mps) if t.max_speed_mps is not None else None,
            "start_address": t.start_address,
            "end_address": t.end_address,
            "points": thin_route(by_trip[t.id]),
        }
        for t in trips
        if len(by_trip.get(t.id, [])) >= 2
    ]


async def list_trip_summaries(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    vehicle_id: uuid.UUID | None = None,
    start_time_gte: datetime | None = None,
    start_time_lte: datetime | None = None,
    min_score: int | None = None,
    search: str | None = None,
    sort: str = "newest",
    limit: int = 50,
    offset: int = 0,
):
    """One page of trips, the number matching, and totals over every matching trip."""
    filters = _trip_list_filters(
        user_id=user_id,
        vehicle_id=vehicle_id,
        start_time_gte=start_time_gte,
        start_time_lte=start_time_lte,
        min_score=min_score,
        search=search,
    )

    totals_stmt = (
        select(
            func.count(Trip.id),
            func.coalesce(func.sum(Trip.distance_meters), 0),
            func.coalesce(func.sum(Trip.duration_seconds), 0),
            func.max(Trip.max_speed_mps),
        )
        .select_from(Trip)
        .join(Vehicle, Vehicle.id == Trip.vehicle_id)
        .join(VehicleModel, VehicleModel.id == Vehicle.model_id)
        .join(VehicleCompany, VehicleCompany.id == VehicleModel.company_id)
        .where(*filters)
    )
    count, distance, duration, top = (await db.execute(totals_stmt)).one()
    totals = {
        "count": int(count or 0),
        "distance_meters": float(distance or 0),
        "duration_seconds": int(duration or 0),
        "max_speed_mps": float(top) if top is not None else None,
    }
    total = totals["count"]

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
            Trip.max_speed_mps,
            Trip.start_address,
            Trip.end_address,
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
            Trip.max_speed_mps,
            Trip.start_address,
            Trip.end_address,
            Vehicle.name,
            VehicleModel.name,
            VehicleModel.image_url,
            VehicleCompany.name,
        )
        .order_by(*trip_sort_order(sort))
        .limit(limit)
        .offset(offset)
    )

    result = await db.execute(stmt)
    return result.all(), total, totals


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


async def apply_track_metrics(db: AsyncSession, trip: Trip) -> None:
    """Per-trip figures derived from the whole GPS track: turns, and a GPS G-force estimate when no
    sensor value arrived (older app, simulator, no accelerometer). Shared by trip close and backfill."""
    track = (
        await db.execute(
            select(
                LocationPoint.recorded_at,
                LocationPoint.latitude,
                LocationPoint.longitude,
                LocationPoint.speed_mps,
                LocationPoint.heading_deg,
            )
            .where(LocationPoint.trip_id == trip.id)
            .order_by(LocationPoint.recorded_at, LocationPoint.id)
        )
    ).all()
    turns = detect_turns(track)
    trip.left_turns = turns.left
    trip.right_turns = turns.right
    if trip.max_g_force is None:
        estimate = estimate_max_g_from_speeds(track)
        if estimate is not None:
            trip.max_g_force = estimate
            trip.max_g_source = "gps"


async def _close_trip(db: AsyncSession, trip: Trip, *, end_time: datetime) -> Trip:
    """Mark a trip ended. Shared by the normal end call and the abandoned-trip backstop."""
    await apply_track_metrics(db, trip)
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


async def delete_trip(db: AsyncSession, *, user_id: uuid.UUID, trip_id: uuid.UUID, now: datetime | None = None) -> bool:
    """Soft-delete one of the user's trips. Returns False when there is no such trip to delete.

    This is the client's Discard: points are uploaded during the drive, so a discarded drive already
    exists server-side. A trip that was never ended (the end call failed or never ran) is marked
    ended as well, so it can never read as an ongoing trip again.
    """
    result = await db.execute(
        select(Trip).where(Trip.id == trip_id, Trip.user_id == user_id, Trip.deleted_at.is_(None))
    )
    trip = result.scalar_one_or_none()
    if trip is None:
        return False
    effective_now = now or datetime.now(timezone.utc)
    if trip.state != TripState.ended:
        trip.state = TripState.ended
        trip.end_time = trip.end_time or effective_now
    trip.deleted_at = effective_now
    await db.commit()
    return True


async def update_trip_vehicle(
    db: AsyncSession, *, user_id: uuid.UUID, trip_id: uuid.UUID, vehicle_id: uuid.UUID
) -> Trip | None:
    """Move one of the user's trips to another of their vehicles. None when there is no such trip.

    Raises ValueError("Vehicle not found") when the vehicle is not the user's.
    """
    result = await db.execute(
        select(Trip).where(Trip.id == trip_id, Trip.user_id == user_id, Trip.deleted_at.is_(None))
    )
    trip = result.scalar_one_or_none()
    if trip is None:
        return None
    await _ensure_vehicle_owned(db, user_id=user_id, vehicle_id=vehicle_id)
    trip.vehicle_id = vehicle_id
    await db.commit()
    await db.refresh(trip)
    return trip


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


async def finish_trip(db: AsyncSession, *, user_id: uuid.UUID, trip_id: uuid.UUID, data) -> Trip:
    """Stores the phone's numbers for a drive and ends it (local-first part 2b).

    Works whether the trip is still open or the abandoned-trip backstop already closed it (a drive
    uploaded long after it happened): either way the phone's figures and events replace whatever the
    server had. Raises ValueError when the trip is not the user's.
    """
    trip = (
        await db.execute(select(Trip).where(Trip.id == trip_id, Trip.user_id == user_id, Trip.deleted_at.is_(None)))
    ).scalar_one_or_none()
    if trip is None:
        raise ValueError("Trip not found")
    if data.end_time < _as_utc(trip.start_time):
        raise ValueError("end_time must be >= start_time")

    trip.state = TripState.ended
    trip.end_time = data.end_time
    trip.distance_meters = data.distance_meters
    trip.duration_seconds = data.duration_seconds
    trip.idle_time_seconds = data.idle_time_seconds
    trip.driving_score = data.driving_score
    trip.max_g_force = data.max_g_force
    trip.max_g_source = data.max_g_source
    trip.left_turns = data.left_turns
    trip.right_turns = data.right_turns
    trip.avg_speed_mps = data.distance_meters / data.duration_seconds if data.duration_seconds > 0 else None

    await db.execute(delete(Event).where(Event.trip_id == trip.id))
    for event in data.events:
        db.add(
            Event(
                trip_id=trip.id,
                event_type=event.event_type,
                intensity=event.intensity,
                occurred_at=event.occurred_at,
                latitude=event.latitude,
                longitude=event.longitude,
                payload={"source": "phone"},
            )
        )
    await db.commit()
    await db.refresh(trip)
    return trip
