import uuid
from datetime import datetime, timezone

from app.main import app
from app.models.trip import Trip
from app.services.sync_service import decode_cursor, encode_cursor


def test_cursor_round_trips_and_bad_ones_mean_from_the_start():
    at = datetime(2026, 10, 17, 8, 30, 1, 123456, tzinfo=timezone.utc)
    row = uuid.uuid4()
    assert decode_cursor(encode_cursor(at, row)) == (at, row)
    assert decode_cursor(None) is None
    assert decode_cursor("") is None
    assert decode_cursor("not-a-cursor") is None
    assert decode_cursor("2026-10-17|nope") is None


def test_updated_at_moves_on_every_change():
    assert Trip.__table__.c.updated_at.onupdate is not None


def test_sync_pull_route_is_registered():
    route = next(r for r in app.routes if getattr(r, "path", "") == "/api/v1/sync/pull")
    assert "GET" in route.methods


def test_sync_trip_carries_what_the_phone_needs_for_stats():
    from app.schemas.sync import SyncTrip

    fields = SyncTrip.model_fields
    for name in ("idle_time_seconds", "harsh_brake_count", "rapid_acceleration_count", "overspeed_count", "max_g_force", "left_turns"):
        assert name in fields


def test_delete_cloud_drives_route_is_registered():
    route = next(r for r in app.routes if getattr(r, "path", "") == "/api/v1/sync/delete-drives")
    assert "POST" in route.methods


async def test_delete_cloud_drives_hard_deletes_only_this_users_trips():
    from unittest.mock import AsyncMock, MagicMock

    from app.services.sync_service import delete_cloud_drives

    db = MagicMock()
    db.execute = AsyncMock(return_value=MagicMock(rowcount=3))
    db.commit = AsyncMock()
    user_id = uuid.uuid4()
    assert await delete_cloud_drives(db, user_id=user_id) == 3
    statement = db.execute.call_args.args[0]
    assert statement.is_delete and user_id.hex in str(statement.compile(compile_kwargs={"literal_binds": True}))
    db.commit.assert_awaited_once()
