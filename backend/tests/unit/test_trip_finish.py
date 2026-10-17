import uuid
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from pydantic import ValidationError

from app.main import app
from app.models.enums import TripState
from app.schemas.trip import TripFinishRequest
from app.services.trip_service import finish_trip

T0 = datetime(2026, 10, 17, 8, tzinfo=timezone.utc)


def _request(**patch):
    body = {
        "end_time": (T0 + timedelta(minutes=23)).isoformat(),
        "distance_meters": 12_400,
        "duration_seconds": 1380,
        "idle_time_seconds": 90,
        "driving_score": 94,
        "max_g_force": 0.42,
        "max_g_source": "sensor",
        "left_turns": 3,
        "right_turns": 5,
        "events": [{"event_type": "harsh_brake", "intensity": 1.2, "occurred_at": (T0 + timedelta(minutes=5)).isoformat(), "latitude": 28.6, "longitude": 77.2}],
    }
    body.update(patch)
    return TripFinishRequest.model_validate(body)


def _db(trip):
    result = MagicMock()
    result.scalar_one_or_none.return_value = trip
    db = MagicMock()
    db.execute = AsyncMock(return_value=result)
    db.commit = AsyncMock()
    db.refresh = AsyncMock()
    db.add = MagicMock()
    return db


def test_finish_request_checks_the_phone_numbers():
    assert _request().driving_score == 94
    with pytest.raises(ValidationError):
        _request(driving_score=120)
    with pytest.raises(ValidationError):
        _request(events=[{"event_type": "teleport", "intensity": 1, "occurred_at": T0.isoformat(), "latitude": 0, "longitude": 0}])


async def test_finish_stores_the_phone_numbers_even_on_a_trip_already_closed():
    trip = SimpleNamespace(id=uuid.uuid4(), start_time=T0, state=TripState.ended, end_time=T0 + timedelta(minutes=10), distance_meters=0)
    db = _db(trip)
    await finish_trip(db, user_id=uuid.uuid4(), trip_id=trip.id, data=_request())
    assert (trip.distance_meters, trip.duration_seconds, trip.driving_score) == (12_400, 1380, 94)
    assert (trip.left_turns, trip.right_turns, trip.max_g_source, trip.idle_time_seconds) == (3, 5, "sensor", 90)
    assert trip.end_time == T0 + timedelta(minutes=23)
    assert trip.avg_speed_mps == pytest.approx(12_400 / 1380)
    assert db.add.call_count == 1  # the one phone event, after the old ones were deleted
    db.commit.assert_awaited_once()


async def test_finish_refuses_a_trip_that_is_not_yours():
    with pytest.raises(ValueError, match="Trip not found"):
        await finish_trip(_db(None), user_id=uuid.uuid4(), trip_id=uuid.uuid4(), data=_request())


def test_finish_route_is_registered():
    route = next(r for r in app.routes if getattr(r, "path", "") == "/api/v1/trips/{trip_id}/finish")
    assert "POST" in route.methods
