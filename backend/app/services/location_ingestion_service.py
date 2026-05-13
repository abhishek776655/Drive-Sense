from __future__ import annotations

import uuid
from itertools import islice
from math import atan2, cos, radians, sin, sqrt
from typing import Iterable

from sqlalchemy import insert, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.event import Event
from app.models.enums import TripState
from app.models.location_point import LocationPoint
from app.models.trip import Trip
from app.models.vehicle import Vehicle
from app.schemas.event import EventCreate
from app.schemas.location_point import LocationPointCreate
from app.services.driving_event_detection_service import (
    DetectionPoint,
    detect_driving_events,
    serialize_detected_events,
)


LOCATION_INSERT_CHUNK_SIZE = 1000
EVENT_INSERT_CHUNK_SIZE = 500
IDLE_SPEED_THRESHOLD_MPS = 0.8


def _distance_meters_between(
    *,
    left_latitude: float,
    left_longitude: float,
    right_latitude: float,
    right_longitude: float,
) -> float:
    earth_radius_m = 6371000
    delta_lat = radians(right_latitude - left_latitude)
    delta_lon = radians(right_longitude - left_longitude)
    lat1 = radians(left_latitude)
    lat2 = radians(right_latitude)
    a = sin(delta_lat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(delta_lon / 2) ** 2
    c = 2 * atan2(sqrt(a), sqrt(1 - a))
    return earth_radius_m * c


def _chunked(items: list[dict], size: int) -> Iterable[list[dict]]:
    iterator = iter(items)
    while chunk := list(islice(iterator, size)):
        yield chunk


async def ingest_location_points(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    trip_id: uuid.UUID,
    points: list[LocationPointCreate],
    detect_events: bool = True,
) -> int:
    trip_result = await db.execute(
        select(Trip).where(
            Trip.id == trip_id,
            Trip.user_id == user_id,
            Trip.deleted_at.is_(None),
        )
    )
    trip = trip_result.scalar_one_or_none()
    if trip is None:
        raise ValueError("Trip not found")
    if trip.state == TripState.ended or trip.end_time is not None:
        raise ValueError("Trip already ended")
    if not points:
        raise ValueError("At least one location point is required")

    previous_point_result = await db.execute(
        select(LocationPoint)
        .where(LocationPoint.trip_id == trip_id)
        .order_by(LocationPoint.recorded_at.desc(), LocationPoint.id.desc())
        .limit(1)
    )
    previous_point = previous_point_result.scalar_one_or_none()

    payload = [
        {
            "trip_id": trip_id,
            "recorded_at": point.recorded_at,
            "latitude": point.latitude,
            "longitude": point.longitude,
            "speed_mps": point.speed_mps,
            "heading_deg": point.heading_deg,
            "accuracy_m": point.accuracy_m,
            "altitude_m": point.altitude_m,
            "is_moving": point.is_moving,
            "provider": point.provider,
        }
        for point in points
    ]

    detection_points: list[DetectionPoint] = []
    if previous_point is not None:
        detection_points.append(
            DetectionPoint(
                recorded_at=previous_point.recorded_at,
                latitude=previous_point.latitude,
                longitude=previous_point.longitude,
                speed_mps=previous_point.speed_mps,
            )
        )
    detection_points.extend(
        DetectionPoint(
            recorded_at=point.recorded_at,
            latitude=point.latitude,
            longitude=point.longitude,
            speed_mps=point.speed_mps,
        )
        for point in points
    )

    incremental_distance_meters = 0.0
    incremental_idle_seconds = 0
    aggregate_previous = previous_point
    for point in points:
        if aggregate_previous is not None:
            incremental_distance_meters += _distance_meters_between(
                left_latitude=aggregate_previous.latitude,
                left_longitude=aggregate_previous.longitude,
                right_latitude=point.latitude,
                right_longitude=point.longitude,
            )
            delta_seconds = int((point.recorded_at - aggregate_previous.recorded_at).total_seconds())
            is_idle = (
                (point.is_moving is False)
                or ((point.speed_mps or 0) <= IDLE_SPEED_THRESHOLD_MPS)
            )
            if delta_seconds > 0 and is_idle:
                incremental_idle_seconds += delta_seconds
        aggregate_previous = point

    for batch in _chunked(payload, LOCATION_INSERT_CHUNK_SIZE):
        await db.execute(insert(LocationPoint), batch)

    trip.distance_meters = float(trip.distance_meters or 0) + incremental_distance_meters
    latest_recorded_at = points[-1].recorded_at
    trip.duration_seconds = max(0, int((latest_recorded_at - trip.start_time).total_seconds()))
    trip.idle_time_seconds = int(trip.idle_time_seconds or 0) + incremental_idle_seconds
    batch_max_speed = max((point.speed_mps or 0) for point in points)
    trip.max_speed_mps = max(float(trip.max_speed_mps or 0), batch_max_speed)
    trip.avg_speed_mps = (
        trip.distance_meters / trip.duration_seconds if trip.duration_seconds > 0 else 0
    )

    vehicle_result = await db.execute(select(Vehicle).where(Vehicle.id == trip.vehicle_id))
    vehicle = vehicle_result.scalar_one_or_none()
    if vehicle is not None and vehicle.fuel_type.value != "electric" and vehicle.mileage_baseline_km_per_l:
        trip.fuel_used_liters = float(trip.distance_meters) / 1000 / float(vehicle.mileage_baseline_km_per_l)

    if detect_events:
        detected_events = detect_driving_events(
            detection_points,
            baseline_included=previous_point is not None,
        )
        if detected_events:
            event_payload = serialize_detected_events(trip_id, detected_events)
            for batch in _chunked(event_payload, EVENT_INSERT_CHUNK_SIZE):
                await db.execute(insert(Event), batch)

    if trip.state in {TripState.started, TripState.paused, TripState.idle}:
        trip.state = TripState.active

    await db.commit()
    return len(payload)


async def ingest_events(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    trip_id: uuid.UUID,
    events: list[EventCreate],
) -> int:
    trip_result = await db.execute(
        select(Trip).where(
            Trip.id == trip_id,
            Trip.user_id == user_id,
            Trip.deleted_at.is_(None),
        )
    )
    trip = trip_result.scalar_one_or_none()
    if trip is None:
        raise ValueError("Trip not found")
    if trip.state == TripState.ended or trip.end_time is not None:
        raise ValueError("Trip already ended")
    if not events:
        raise ValueError("At least one event is required")

    payload = [
        {
            "trip_id": trip_id,
            "event_type": event.event_type,
            "intensity": event.intensity,
            "occurred_at": event.occurred_at,
            "latitude": event.latitude,
            "longitude": event.longitude,
            "payload": event.payload,
        }
        for event in events
    ]

    for batch in _chunked(payload, EVENT_INSERT_CHUNK_SIZE):
        await db.execute(insert(Event), batch)

    if trip.state in {TripState.started, TripState.paused, TripState.idle}:
        trip.state = TripState.active

    await db.commit()
    return len(payload)
