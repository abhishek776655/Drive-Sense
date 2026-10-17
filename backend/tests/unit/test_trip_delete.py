import uuid
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

from app.models.trip import TripState
from app.services.trip_service import delete_trip

NOW = datetime(2026, 10, 10, 12, 0, tzinfo=timezone.utc)


def _db_returning(trip):
    result = MagicMock()
    result.scalar_one_or_none.return_value = trip
    db = MagicMock()
    db.execute = AsyncMock(return_value=result)
    db.commit = AsyncMock()
    return db


async def test_soft_deletes_an_ended_trip():
    trip = SimpleNamespace(state=TripState.ended, end_time=NOW, deleted_at=None)
    db = _db_returning(trip)
    assert await delete_trip(db, user_id=uuid.uuid4(), trip_id=uuid.uuid4(), now=NOW) is True
    assert trip.deleted_at == NOW
    assert trip.end_time == NOW
    db.commit.assert_awaited_once()


async def test_closes_an_open_trip_while_deleting_it():
    trip = SimpleNamespace(state=TripState.active, end_time=None, deleted_at=None)
    db = _db_returning(trip)
    assert await delete_trip(db, user_id=uuid.uuid4(), trip_id=uuid.uuid4(), now=NOW) is True
    assert trip.state == TripState.ended
    assert trip.end_time == NOW
    assert trip.deleted_at == NOW


async def test_missing_or_foreign_trip_is_not_deleted():
    db = _db_returning(None)
    assert await delete_trip(db, user_id=uuid.uuid4(), trip_id=uuid.uuid4(), now=NOW) is False
    db.commit.assert_not_awaited()
