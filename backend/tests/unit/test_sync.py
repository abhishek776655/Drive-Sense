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
