import uuid
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock
from zoneinfo import ZoneInfo

from app.core.security import hash_password
from app.main import app
from app.services.auth_service import delete_account
from app.services.trip_export_service import CSV_HEADER, ExportRow, trips_to_csv


def _row(**overrides):
    base = dict(
        start_time=datetime(2026, 10, 12, 3, 30, tzinfo=timezone.utc),
        end_time=datetime(2026, 10, 12, 4, 10, tzinfo=timezone.utc),
        vehicle="Skoda Citigo",
        distance_meters=14200.0,
        duration_seconds=2400,
        idle_seconds=240,
        max_speed_mps=27.5,
        score=91,
        start_address="Sector 29, Gurugram",
        end_address="Noida",
    )
    return ExportRow(**{**base, **overrides})


def test_csv_has_a_header_and_local_times():
    lines = trips_to_csv([_row()], ZoneInfo("Asia/Kolkata")).strip().splitlines()
    assert lines[0] == ",".join(CSV_HEADER)
    # 03:30 UTC is 09:00 in India; 14.2 km in 2160 s moving is 23.7 km/h.
    assert lines[1] == '2026-10-12,09:00,09:40,Skoda Citigo,14.20,40.0,23.7,99.0,91,"Sector 29, Gurugram",Noida'


def test_csv_leaves_unknowns_blank():
    line = trips_to_csv([_row(end_time=None, max_speed_mps=None, score=None, duration_seconds=0, idle_seconds=0, end_address=None)], ZoneInfo("UTC")).splitlines()[1]
    assert line.endswith(',,,,"Sector 29, Gurugram",')


async def test_delete_account_needs_the_password():
    user = SimpleNamespace(id=uuid.uuid4(), password_hash=hash_password("secret-pass"))
    db = MagicMock()
    db.execute = AsyncMock()
    db.commit = AsyncMock()
    assert await delete_account(db, user=user, password="wrong") is False
    db.execute.assert_not_awaited()
    assert await delete_account(db, user=user, password="secret-pass") is True
    db.execute.assert_awaited_once()
    db.commit.assert_awaited_once()


def test_routes_are_registered_and_export_comes_before_trip_id():
    paths = {(route.path, method) for route in app.routes for method in getattr(route, "methods", set())}
    assert ("/api/v1/auth/me", "DELETE") in paths
    ordered = [route.path for route in app.routes if "GET" in getattr(route, "methods", set())]
    assert ordered.index("/api/v1/trips/export.csv") < ordered.index("/api/v1/trips/{trip_id}")
