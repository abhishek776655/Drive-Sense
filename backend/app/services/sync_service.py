"""Incremental pull for the phone's local database (spec 2026-10-17, local-first part 1).

Rows are ordered by (updated_at, id) and the cursor is the last pair sent, so rows sharing a
timestamp are never skipped. Soft-deleted rows come back as deletions.
"""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import and_, case, delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import TripState
from app.models.event import Event
from app.models.trip import Trip
from app.models.vehicle import Vehicle
from app.models.vehicle_catalog import VehicleCompany, VehicleModel
from app.schemas.sync import SyncDeleted, SyncPage, SyncTrip
from app.schemas.vehicle import VehicleRead
from app.services.trip_service import _vehicle_display_name_expr
from app.services.vehicle_service import _VEHICLE_LOAD_OPTIONS


def encode_cursor(at: datetime, row_id: uuid.UUID) -> str:
    return f"{at.isoformat()}|{row_id}"


def decode_cursor(cursor: str | None) -> tuple[datetime, uuid.UUID] | None:
    """None for no cursor (first sync) or anything unreadable, which simply means "from the start"."""
    if not cursor:
        return None
    try:
        at, row_id = cursor.rsplit("|", 1)
        return datetime.fromisoformat(at), uuid.UUID(row_id)
    except ValueError:
        return None


def _after(column_at, column_id, since: tuple[datetime, uuid.UUID] | None):
    if since is None:
        return True
    at, row_id = since
    return or_(column_at > at, and_(column_at == at, column_id > row_id))


def _count_of(event_type: str):
    return func.coalesce(func.sum(case((Event.event_type == event_type, 1), else_=0)), 0).label(f"{event_type}_count")


async def pull(db: AsyncSession, *, user_id: uuid.UUID, since: str | None, limit: int = 200) -> SyncPage:
    after = decode_cursor(since)

    page = (
        await db.execute(
            select(Trip.id, Trip.updated_at, Trip.deleted_at)
            .where(Trip.user_id == user_id, Trip.state == TripState.ended, _after(Trip.updated_at, Trip.id, after))
            .order_by(Trip.updated_at, Trip.id)
            .limit(limit + 1)
        )
    ).all()
    has_more = len(page) > limit
    page = page[:limit]
    live_ids = [row.id for row in page if row.deleted_at is None]
    deleted_trips = [SyncDeleted(id=row.id, deleted_at=row.deleted_at) for row in page if row.deleted_at is not None]

    trips: list[SyncTrip] = []
    if live_ids:
        rows = (
            await db.execute(
                select(
                    Trip,
                    _vehicle_display_name_expr().label("vehicle_name"),
                    VehicleModel.image_url.label("vehicle_image_url"),
                    func.count(Event.id).label("event_count"),
                    _count_of("harsh_brake"),
                    _count_of("rapid_acceleration"),
                    _count_of("overspeed"),
                    _count_of("sharp_turn"),
                )
                .join(Vehicle, Vehicle.id == Trip.vehicle_id)
                .join(VehicleModel, VehicleModel.id == Vehicle.model_id)
                .join(VehicleCompany, VehicleCompany.id == VehicleModel.company_id)
                .outerjoin(Event, Event.trip_id == Trip.id)
                .where(Trip.id.in_(live_ids))
                .group_by(Trip.id, Vehicle.name, VehicleModel.name, VehicleModel.image_url, VehicleCompany.name)
                .order_by(Trip.updated_at, Trip.id)
            )
        ).all()
        trips = [
            SyncTrip(
                id=t.id,
                user_id=t.user_id,
                vehicle_id=t.vehicle_id,
                state=t.state,
                start_time=t.start_time,
                end_time=t.end_time,
                distance_meters=float(t.distance_meters or 0),
                duration_seconds=t.duration_seconds,
                created_at=t.created_at,
                updated_at=t.updated_at,
                max_g_force=t.max_g_force,
                max_g_source=t.max_g_source,
                left_turns=t.left_turns,
                right_turns=t.right_turns,
                vehicle_name=vehicle_name,
                vehicle_image_url=image_url,
                driving_score=t.driving_score,
                avg_speed_mps=float(t.avg_speed_mps) if t.avg_speed_mps is not None else None,
                max_speed_mps=float(t.max_speed_mps) if t.max_speed_mps is not None else None,
                start_address=t.start_address,
                end_address=t.end_address,
                event_count=int(event_count or 0),
                idle_time_seconds=t.idle_time_seconds or 0,
                harsh_brake_count=int(brakes or 0),
                rapid_acceleration_count=int(launches or 0),
                overspeed_count=int(overspeeds or 0),
                sharp_turn_count=int(sharp_turns or 0),
            )
            for t, vehicle_name, image_url, event_count, brakes, launches, overspeeds, sharp_turns in rows
        ]

    # Vehicles are few: every one changed after the cursor rides along with each page.
    vehicle_rows = (
        (
            await db.execute(
                select(Vehicle)
                .where(Vehicle.user_id == user_id, _after(Vehicle.updated_at, Vehicle.id, after))
                .options(*_VEHICLE_LOAD_OPTIONS)
                .order_by(Vehicle.updated_at, Vehicle.id)
            )
        )
        .scalars()
        .all()
    )
    vehicles = [VehicleRead.model_validate(v) for v in vehicle_rows if v.deleted_at is None]
    deleted_vehicles = [SyncDeleted(id=v.id, deleted_at=v.deleted_at) for v in vehicle_rows if v.deleted_at is not None]

    # Next cursor: the last trip sent, or (no trips) the newest vehicle change.
    cursor = since
    if page:
        cursor = encode_cursor(page[-1].updated_at, page[-1].id)
    elif vehicle_rows:
        cursor = encode_cursor(vehicle_rows[-1].updated_at, vehicle_rows[-1].id)
    if not has_more and vehicle_rows:
        newest = vehicle_rows[-1]
        current = decode_cursor(cursor)
        if current is None or (newest.updated_at, newest.id) > current:
            cursor = encode_cursor(newest.updated_at, newest.id)

    return SyncPage(vehicles=vehicles, deleted_vehicles=deleted_vehicles, trips=trips, deleted_trips=deleted_trips, cursor=cursor, has_more=has_more)


async def delete_cloud_drives(db: AsyncSession, *, user_id: uuid.UUID) -> int:
    """Permanently deletes every drive the user has on the server, with its points and events (the
    database cascades). For "This phone only" (local-first part 3): no tombstones are left, since
    the phone keeps its own copies. The account and vehicles stay. Returns how many went."""
    result = await db.execute(delete(Trip).where(Trip.user_id == user_id))
    await db.commit()
    return result.rowcount or 0
