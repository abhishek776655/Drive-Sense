from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.event import Event
from app.models.enums import TripState
from app.models.trip import Trip
from app.models.vehicle import Vehicle
from app.models.vehicle_catalog import VehicleCompany, VehicleModel
from app.services.driving_score_service import update_trip_driving_score


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


async def start_trip(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    vehicle_id: uuid.UUID,
    start_time: datetime | None,
) -> Trip:
    await _ensure_vehicle_owned(db, user_id=user_id, vehicle_id=vehicle_id)

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

    trip.end_time = effective_end_time
    trip.state = TripState.ended
    if distance_meters is not None:
        trip.distance_meters = distance_meters
    if duration_seconds is not None:
        trip.duration_seconds = duration_seconds
    else:
        trip.duration_seconds = int((effective_end_time - trip.start_time).total_seconds())
    trip = await update_trip_driving_score(db, trip)
    await db.commit()
    await db.refresh(trip)
    return trip
