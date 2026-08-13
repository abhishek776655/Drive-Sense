from datetime import datetime, timedelta, timezone

from app.services.trip_service import STALE_TRIP_IDLE_SECONDS, resolve_stale_trip_end


NOW = datetime(2026, 8, 14, 12, 0, 0, tzinfo=timezone.utc)


def test_trip_with_a_recent_point_is_still_live():
    end = resolve_stale_trip_end(
        start_time=NOW - timedelta(hours=2),
        last_point_at=NOW - timedelta(seconds=30),
        now=NOW,
    )

    assert end is None


def test_trip_is_closed_at_its_last_point_once_idle():
    last_point_at = NOW - timedelta(seconds=STALE_TRIP_IDLE_SECONDS + 1)

    end = resolve_stale_trip_end(
        start_time=NOW - timedelta(hours=3),
        last_point_at=last_point_at,
        now=NOW,
    )

    assert end == last_point_at


def test_pointless_trip_falls_back_to_its_start_time():
    start_time = NOW - timedelta(days=2)

    end = resolve_stale_trip_end(start_time=start_time, last_point_at=None, now=NOW)

    assert end == start_time


def test_freshly_started_trip_without_points_is_not_stale():
    end = resolve_stale_trip_end(start_time=NOW - timedelta(seconds=5), last_point_at=None, now=NOW)

    assert end is None


def test_trip_exactly_at_the_threshold_is_not_yet_stale():
    end = resolve_stale_trip_end(
        start_time=NOW - timedelta(hours=1),
        last_point_at=NOW - timedelta(seconds=STALE_TRIP_IDLE_SECONDS),
        now=NOW,
    )

    assert end is None


def test_naive_timestamps_are_treated_as_utc():
    # asyncpg can hand back naive datetimes depending on the column type; comparing those against an
    # aware `now` would raise instead of closing the trip.
    last_point_at = (NOW - timedelta(hours=5)).replace(tzinfo=None)

    end = resolve_stale_trip_end(
        start_time=(NOW - timedelta(hours=6)).replace(tzinfo=None),
        last_point_at=last_point_at,
        now=NOW,
    )

    assert end == last_point_at.replace(tzinfo=timezone.utc)


def test_open_trips_query_compiles_against_postgres():
    # The reaper's query joins a grouped subquery. Compiling it here catches a malformed statement
    # without needing a database, which the DB-backed paths of close_stale_trips still do.
    import uuid

    from sqlalchemy.dialects import postgresql

    from app.services.trip_service import open_trips_with_last_point_stmt

    sql = str(
        open_trips_with_last_point_stmt(user_id=uuid.uuid4()).compile(
            dialect=postgresql.dialect(), compile_kwargs={"literal_binds": True}
        )
    )

    assert "max(location_points.recorded_at)" in sql
    assert "GROUP BY location_points.trip_id" in sql
    assert "LEFT OUTER JOIN" in sql
    assert "trips.state !=" in sql


def test_open_trips_query_can_scope_to_one_vehicle():
    import uuid

    from sqlalchemy.dialects import postgresql

    from app.services.trip_service import open_trips_with_last_point_stmt

    vehicle_id = uuid.uuid4()
    sql = str(
        open_trips_with_last_point_stmt(user_id=uuid.uuid4(), vehicle_id=vehicle_id).compile(
            dialect=postgresql.dialect(), compile_kwargs={"literal_binds": True}
        )
    )

    assert str(vehicle_id) in sql
