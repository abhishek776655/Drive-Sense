from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from app.main import app
from app.services.stats_overview_service import (
    band_index,
    best_streak,
    city_name,
    custom_granularity,
    period_start,
    top_places,
    trend_bucket_starts,
)

IST = ZoneInfo("Asia/Kolkata")
# A Friday.
NOW = datetime(2026, 10, 16, 18, 30, tzinfo=IST)


def test_period_starts_at_local_midnight():
    assert period_start("week", NOW) == datetime(2026, 10, 12, tzinfo=IST)
    assert period_start("month", NOW) == datetime(2026, 10, 1, tzinfo=IST)
    assert period_start("year", NOW) == datetime(2026, 1, 1, tzinfo=IST)
    assert period_start("all", NOW) is None


def test_trend_buckets_follow_the_period():
    today = NOW.date()
    week = trend_bucket_starts("week", today, None)
    assert week[0] == date(2026, 10, 12) and len(week) == 7
    month = trend_bucket_starts("month", today, None)
    assert month[0] == date(2026, 10, 1) and month[-1] == today
    assert trend_bucket_starts("year", today, None) == [date(2026, m, 1) for m in range(1, 13)]


def test_all_time_trend_runs_from_the_first_drive_and_caps_at_24_months():
    today = NOW.date()
    assert trend_bucket_starts("all", today, date(2026, 8, 20)) == [date(2026, 8, 1), date(2026, 9, 1), date(2026, 10, 1)]
    long = trend_bucket_starts("all", today, date(2019, 1, 5))
    assert len(long) == 24 and long[-1] == date(2026, 10, 1) and long[0] == date(2024, 11, 1)
    assert trend_bucket_starts("all", today, None) == [date(2026, 10, 1)]


def test_speed_bands_are_20_kmh_wide_with_an_open_top():
    assert band_index(0) == 0
    assert band_index(19.9) == 0
    assert band_index(20) == 1
    assert band_index(99) == 4
    assert band_index(180) == 5


def test_best_streak_finds_the_longest_run():
    d = date(2026, 10, 1)
    assert best_streak([]) == 0
    assert best_streak([d]) == 1
    assert best_streak([d, d + timedelta(1), d + timedelta(2), d + timedelta(5), d + timedelta(6)]) == 3
    assert best_streak([d, d]) == 1


def test_places_group_by_city_and_rank_by_visits():
    assert city_name("Sector 29, Gurugram") == "Gurugram"
    assert city_name("  ") is None
    assert city_name(None) is None
    places = top_places([("A Road, Gurugram", 2), ("B Road, Gurugram", 1), ("Delhi", 3), (None, 9), ("X, Agra", 1)], limit=2)
    assert [(p.name, p.visits) for p in places] == [("Delhi", 3), ("Gurugram", 3)]


def test_overview_route_is_registered():
    paths = {(route.path, method) for route in app.routes for method in getattr(route, "methods", set())}
    assert ("/api/v1/stats/overview", "GET") in paths


def test_custom_range_gets_a_bar_per_day_then_per_month():
    today = NOW.date()
    days = trend_bucket_starts("custom", today, None, (date(2026, 9, 28), date(2026, 10, 3)))
    assert days == [date(2026, 9, 28) + timedelta(days=i) for i in range(6)]
    assert custom_granularity(date(2026, 1, 1), date(2026, 3, 3)) == "day"
    assert custom_granularity(date(2026, 1, 1), date(2026, 3, 4)) == "month"
    months = trend_bucket_starts("custom", today, None, (date(2025, 11, 15), date(2026, 2, 2)))
    assert months == [date(2025, 11, 1), date(2025, 12, 1), date(2026, 1, 1), date(2026, 2, 1)]


def test_elevation_gain_ignores_jitter():
    from app.services.stats_overview_service import elevation_gain

    assert elevation_gain([]) == 0
    assert elevation_gain([200, 201, 199, 200.5]) == 0
    assert elevation_gain([200, 204, 202, 210, 206]) == 10


def test_parts_of_day_and_weekdays():
    from app.services.stats_overview_service import drive_shares, part_of_day

    assert [part_of_day(h) for h in (5, 11, 12, 16, 17, 20, 21, 2)] == ["Morning", "Morning", "Afternoon", "Afternoon", "Evening", "Evening", "Night", "Night"]
    # 03:30 UTC is 09:00 Friday in India; 16:00 UTC is 21:30.
    parts, days, hours = drive_shares([(datetime(2026, 10, 16, 3, 30, tzinfo=ZoneInfo("UTC")), 5000), (datetime(2026, 10, 16, 16, 0, tzinfo=ZoneInfo("UTC")), 2000)], IST)
    assert [(p.label, p.trips) for p in parts] == [("Morning", 1), ("Afternoon", 0), ("Evening", 0), ("Night", 1)]
    assert next(d for d in days if d.label == "Fri").distance_meters == 7000
    assert len(days) == 7
    assert len(hours) == 24 and hours[9].trips == 1 and hours[21].trips == 1 and hours[3].trips == 0
