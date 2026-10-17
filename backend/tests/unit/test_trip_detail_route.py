import uuid
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from app.models.enums import TripState
from app.routers import trips as trips_router

NOW = datetime(2026, 10, 13, 12, 0, tzinfo=timezone.utc)


def _trip():
    return SimpleNamespace(
        id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        vehicle_id=uuid.uuid4(),
        state=TripState.ended,
        start_time=NOW,
        end_time=NOW,
        distance_meters=1000,
        duration_seconds=120,
        created_at=NOW,
        vehicle=SimpleNamespace(display_name="City", image_url=None),
        avg_speed_mps=None,
        max_speed_mps=None,
        idle_time_seconds=0,
        fuel_used_liters=None,
        cost_amount=None,
        cost_currency=None,
        driving_score=90,
        start_address=None,
        end_address=None,
        max_g_force=0.42,
        max_g_source="sensor",
        left_turns=3,
        right_turns=2,
        location_points=[],
        events=[],
    )


async def test_trip_detail_includes_turns_and_max_g():
    trip = _trip()
    with patch.object(trips_router, "get_trip_detail", AsyncMock(return_value=trip)), patch.object(
        trips_router, "generate_trip_insights", return_value=[]
    ):
        detail = await trips_router.get_trip_by_id(trip.id, user=SimpleNamespace(id=trip.user_id), db=AsyncMock())
    assert (detail.left_turns, detail.right_turns) == (3, 2)
    assert (detail.max_g_force, detail.max_g_source) == (0.42, "sensor")
