import uuid
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from app.main import app
from app.services.achievement_service import CATALOG, DriveFacts, compute_achievements, level_for, overview

IST = ZoneInfo("Asia/Kolkata")
T0 = datetime(2026, 10, 1, 4, 30, tzinfo=timezone.utc)  # 10:00 in India


def drive(day: int, *, km=5.0, minutes=20, hour_utc=4, g=None, score=None, harsh=0):
    return DriveFacts(
        trip_id=uuid.uuid4(),
        start_time=T0.replace(hour=hour_utc) + timedelta(days=day),
        distance_meters=km * 1000,
        duration_seconds=minutes * 60,
        max_g=g,
        score=score,
        harsh_events=harsh,
    )


def by_id(achievements):
    return {a.id: a for a in achievements}


def test_catalog_has_38_unique_achievements():
    assert len(CATALOG) == 38
    assert len({a.id for a in CATALOG}) == 38


def test_distance_unlocks_at_the_drive_that_crosses_it():
    drives = [drive(0, km=6), drive(1, km=6), drive(2, km=6)]
    result = by_id(compute_achievements(drives, IST))
    first_miles = result["distance_10"]
    assert first_miles.trip_id == drives[1].trip_id
    assert first_miles.unlocked_at == drives[1].start_time
    assert result["distance_50"].unlocked_at is None
    assert result["distance_50"].progress == 18000


def test_streak_counts_local_days_in_a_row():
    drives = [drive(0), drive(1), drive(2), drive(4)]
    result = by_id(compute_achievements(drives, IST))
    assert result["streak_3"].trip_id == drives[2].trip_id
    assert result["streak_7"].progress == 3


def test_night_drives_use_the_local_clock():
    # 16:00 UTC is 21:30 in India: a night drive there, not in UTC.
    late = drive(0, hour_utc=16)
    assert by_id(compute_achievements([late], IST))["night_1"].unlocked_at is not None
    assert by_id(compute_achievements([late], ZoneInfo("UTC")))["night_1"].unlocked_at is None


def test_smooth_g_force_and_clean_drives():
    drives = [drive(i, score=92, g=0.55, harsh=0) for i in range(10)] + [drive(11, score=70, harsh=2)]
    result = by_id(compute_achievements(drives, IST))
    assert result["smooth_5"].trip_id == drives[4].trip_id
    assert result["gforce_05"].trip_id == drives[0].trip_id
    assert result["gforce_08"].unlocked_at is None
    assert result["clean_10"].trip_id == drives[9].trip_id


def test_levels_and_titles():
    assert level_for(0) == (1, "Learner", 0, 100)
    assert level_for(100)[:2] == (2, "Rookie")
    assert level_for(260)[:2] == (3, "Commuter")
    assert level_for(1000)[0] == 6 and level_for(1000)[1] == "Cruiser"


def test_overview_sums_unlocked_xp():
    result = overview(compute_achievements([drive(0, km=12)], IST))
    # First Drive (25) + First Miles (50).
    assert result.xp == 75 and result.unlocked == 2 and result.total == 38 and result.level == 1


def test_route_is_registered():
    paths = {(route.path, method) for route in app.routes for method in getattr(route, "methods", set())}
    assert ("/api/v1/achievements", "GET") in paths
