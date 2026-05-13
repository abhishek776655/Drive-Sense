from dataclasses import dataclass

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.event import Event
from app.models.trip import Trip


@dataclass
class DrivingScoreInput:
    harsh_brake_count: int = 0
    harsh_acceleration_count: int = 0
    overspeed_duration_seconds: int = 0


BRAKING_PENALTY_WEIGHT = 2.0
ACCELERATION_PENALTY_WEIGHT = 1.5
OVERSPEED_PENALTY_WEIGHT = 0.1


def calculate_driving_score(input_data: DrivingScoreInput) -> int:
    """
    Calculate driving score based on events.

    Formula: Score = 100 - braking_penalty - acceleration_penalty - overspeed_penalty
    Normalized to 0-100 range.
    """
    braking_penalty = input_data.harsh_brake_count * BRAKING_PENALTY_WEIGHT
    acceleration_penalty = input_data.harsh_acceleration_count * ACCELERATION_PENALTY_WEIGHT
    overspeed_penalty = input_data.overspeed_duration_seconds * OVERSPEED_PENALTY_WEIGHT

    score = 100.0 - braking_penalty - acceleration_penalty - overspeed_penalty
    return max(0, min(100, int(score)))


async def get_driving_events_for_trip(db: AsyncSession, trip_id: str) -> DrivingScoreInput:
    """Fetch driving events for a trip and aggregate counts."""
    result = await db.execute(
        select(
            Event.event_type,
            func.count(Event.id).label("count"),
        )
        .where(Event.trip_id == trip_id)
        .group_by(Event.event_type)
    )
    events_by_type = {row.event_type: row.count for row in result.all()}

    overspeed_result = await db.execute(
        select(func.sum(Event.intensity))
        .where(Event.trip_id == trip_id, Event.event_type == "overspeed")
    )
    overspeed_duration = int(overspeed_result.scalar() or 0)

    return DrivingScoreInput(
        harsh_brake_count=events_by_type.get("harsh_brake", 0),
        harsh_acceleration_count=events_by_type.get("rapid_acceleration", 0),
        overspeed_duration_seconds=overspeed_duration,
    )


async def calculate_trip_driving_score(db: AsyncSession, trip_id: str) -> int:
    """Calculate driving score for a trip given its ID."""
    input_data = await get_driving_events_for_trip(db, trip_id)
    return calculate_driving_score(input_data)


async def update_trip_driving_score(db: AsyncSession, trip: Trip) -> Trip:
    """Update the driving_score field for a trip."""
    if trip.state.value == "ended":
        score = await calculate_trip_driving_score(db, str(trip.id))
        trip.driving_score = score
    return trip
