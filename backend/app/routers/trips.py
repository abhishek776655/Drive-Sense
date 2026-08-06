from __future__ import annotations

from uuid import UUID

from datetime import datetime

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.event import EventCreate, EventIngestResponse
from app.schemas.location_point import LocationIngestResponse, LocationPointCreate
from app.schemas.trip import TripDetailRead, TripEndRequest, TripEventRead, TripInsightRead, TripListPage, TripListRead, TripLocationPointRead, TripRead, TripStartRequest
from app.services.location_ingestion_service import ingest_events, ingest_location_points
from app.services.trip_insight_service import generate_trip_insights
from app.services.trip_service import end_trip, get_trip_detail, list_trip_summaries, list_trips, start_trip

router = APIRouter(prefix="/trips")


@router.get("", response_model=TripListPage)
async def get_trips(
    vehicle_id: UUID | None = Query(default=None),
    start_time_gte: datetime | None = Query(default=None),
    start_time_lte: datetime | None = Query(default=None),
    min_score: int | None = Query(default=None, ge=0, le=100),
    search: str | None = Query(default=None, max_length=100),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TripListPage:
    trips, total = await list_trip_summaries(
        db,
        user_id=user.id,
        vehicle_id=vehicle_id,
        start_time_gte=start_time_gte,
        start_time_lte=start_time_lte,
        min_score=min_score,
        search=search,
        limit=limit,
        offset=offset,
    )
    items = [
        TripListRead(
            id=row.id,
            user_id=row.user_id,
            vehicle_id=row.vehicle_id,
            state=row.state,
            start_time=row.start_time,
            end_time=row.end_time,
            distance_meters=float(row.distance_meters or 0),
            duration_seconds=row.duration_seconds,
            created_at=row.created_at,
            vehicle_name=row.vehicle_name,
            vehicle_image_url=row.vehicle_image_url,
            driving_score=row.driving_score,
            avg_speed_mps=float(row.avg_speed_mps) if row.avg_speed_mps is not None else None,
            event_count=int(row.event_count or 0),
        )
        for row in trips
    ]
    return TripListPage(items=items, total=total, limit=limit, offset=offset)


@router.get("/{trip_id}", response_model=TripDetailRead)
async def get_trip_by_id(
    trip_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TripDetailRead:
    trip = await get_trip_detail(db, user_id=user.id, trip_id=trip_id)
    if trip is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trip not found")

    return TripDetailRead(
        id=trip.id,
        user_id=trip.user_id,
        vehicle_id=trip.vehicle_id,
        state=trip.state,
        start_time=trip.start_time,
        end_time=trip.end_time,
        distance_meters=float(trip.distance_meters or 0),
        duration_seconds=trip.duration_seconds,
        created_at=trip.created_at,
        vehicle_name=trip.vehicle.display_name,
        vehicle_image_url=trip.vehicle.image_url,
        avg_speed_mps=float(trip.avg_speed_mps) if trip.avg_speed_mps is not None else None,
        max_speed_mps=float(trip.max_speed_mps) if trip.max_speed_mps is not None else None,
        idle_time_seconds=trip.idle_time_seconds,
        fuel_used_liters=float(trip.fuel_used_liters) if trip.fuel_used_liters is not None else None,
        cost_amount=float(trip.cost_amount) if trip.cost_amount is not None else None,
        cost_currency=trip.cost_currency,
        driving_score=trip.driving_score,
        location_points=[
            TripLocationPointRead(
                id=point.id,
                trip_id=point.trip_id,
                recorded_at=point.recorded_at,
                latitude=point.latitude,
                longitude=point.longitude,
                speed_mps=point.speed_mps,
                heading_deg=point.heading_deg,
                accuracy_m=point.accuracy_m,
                altitude_m=point.altitude_m,
                is_moving=point.is_moving,
                provider=point.provider,
            )
            for point in trip.location_points
        ],
        events=[
            TripEventRead(
                id=event.id,
                trip_id=event.trip_id,
                event_type=event.event_type,
                intensity=float(event.intensity) if event.intensity is not None else None,
                occurred_at=event.occurred_at,
                latitude=event.latitude,
                longitude=event.longitude,
                payload=event.payload,
            )
            for event in trip.events
        ],
        insights=[
            TripInsightRead(
                rule_id=insight.rule_id,
                category=insight.category,
                tone=insight.tone,
                title=insight.title,
                message=insight.message,
                metric_label=insight.metric_label,
                metric_value=insight.metric_value,
                priority=insight.priority,
            )
            for insight in generate_trip_insights(trip)
        ],
    )


@router.post("/start", response_model=TripRead, status_code=201)
async def post_trip_start(
    payload: TripStartRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TripRead:
    try:
        trip = await start_trip(db, user_id=user.id, vehicle_id=payload.vehicle_id, start_time=payload.start_time)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e)) from e
    return TripRead.model_validate(trip)


@router.post("/end", response_model=TripRead)
async def post_trip_end(
    payload: TripEndRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TripRead:
    try:
        trip = await end_trip(
            db,
            user_id=user.id,
            vehicle_id=payload.vehicle_id,
            end_time=payload.end_time,
            distance_meters=payload.distance_meters,
            duration_seconds=payload.duration_seconds,
        )
    except ValueError as e:
        message = str(e)
        if message in {"Vehicle not found", "No active trip for vehicle"}:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=message) from e
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=message) from e
    return TripRead.model_validate(trip)


@router.post("/{trip_id}/locations", response_model=LocationIngestResponse, status_code=202)
async def post_trip_locations(
    trip_id: UUID,
    points: list[LocationPointCreate] = Body(..., min_length=1),
    detect_events: bool = Query(default=True),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> LocationIngestResponse:
    try:
        accepted_points = await ingest_location_points(
            db,
            user_id=user.id,
            trip_id=trip_id,
            points=points,
            detect_events=detect_events,
        )
    except ValueError as e:
        message = str(e)
        if message == "Trip not found":
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=message) from e
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=message) from e

    return LocationIngestResponse(trip_id=trip_id, accepted_points=accepted_points)


@router.post("/{trip_id}/events", response_model=EventIngestResponse, status_code=202)
async def post_trip_events(
    trip_id: UUID,
    events: list[EventCreate] = Body(..., min_length=1),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> EventIngestResponse:
    try:
        accepted_events = await ingest_events(
            db,
            user_id=user.id,
            trip_id=trip_id,
            events=events,
        )
    except ValueError as e:
        message = str(e)
        if message == "Trip not found":
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=message) from e
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=message) from e

    return EventIngestResponse(trip_id=trip_id, accepted_events=accepted_events)
