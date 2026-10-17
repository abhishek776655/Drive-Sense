import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.services.trip_service import update_trip_vehicle


def _result(value):
    result = MagicMock()
    result.scalar_one_or_none.return_value = value
    return result


def _db(*results):
    db = MagicMock()
    db.execute = AsyncMock(side_effect=list(results))
    db.commit = AsyncMock()
    db.refresh = AsyncMock()
    return db


async def test_moves_the_trip_to_another_owned_vehicle():
    new_vehicle = uuid.uuid4()
    trip = SimpleNamespace(vehicle_id=uuid.uuid4())
    # First query: the trip. Second: the ownership check on the vehicle.
    db = _db(_result(trip), _result(new_vehicle))
    updated = await update_trip_vehicle(db, user_id=uuid.uuid4(), trip_id=uuid.uuid4(), vehicle_id=new_vehicle)
    assert updated is trip
    assert trip.vehicle_id == new_vehicle
    db.commit.assert_awaited_once()


async def test_missing_or_foreign_trip_returns_none():
    db = _db(_result(None))
    assert await update_trip_vehicle(db, user_id=uuid.uuid4(), trip_id=uuid.uuid4(), vehicle_id=uuid.uuid4()) is None
    db.commit.assert_not_awaited()


async def test_foreign_vehicle_is_rejected():
    trip = SimpleNamespace(vehicle_id=uuid.uuid4())
    original = trip.vehicle_id
    db = _db(_result(trip), _result(None))
    with pytest.raises(ValueError, match="Vehicle not found"):
        await update_trip_vehicle(db, user_id=uuid.uuid4(), trip_id=uuid.uuid4(), vehicle_id=uuid.uuid4())
    assert trip.vehicle_id == original
    db.commit.assert_not_awaited()
