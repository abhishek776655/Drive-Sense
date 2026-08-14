from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from app.schemas.dashboard import TrendPoint
from app.services.dashboard_service import (
    build_bucket_starts,
    fill_trend_buckets,
    resolve_trend_lookback_days,
    shift_bucket,
    split_trend_window,
    truncate_to_bucket,
)


def _utc(year: int, month: int, day: int, hour: int = 0) -> datetime:
    return datetime(year, month, day, hour, tzinfo=timezone.utc)


def test_resolve_trend_lookback_days_day():
    assert resolve_trend_lookback_days("day") == 30


def test_resolve_trend_lookback_days_week():
    assert resolve_trend_lookback_days("week") == 84


def test_resolve_trend_lookback_days_month():
    assert resolve_trend_lookback_days("month") == 365


def test_resolve_trend_lookback_days_invalid_raises():
    with pytest.raises(KeyError):
        resolve_trend_lookback_days("year")


def test_truncate_to_bucket_day_drops_time_of_day():
    assert truncate_to_bucket(_utc(2026, 8, 15, 17), "day") == _utc(2026, 8, 15)


def test_truncate_to_bucket_week_snaps_back_to_monday():
    # 2026-08-15 is a Saturday; date_trunc('week') returns the preceding Monday.
    assert truncate_to_bucket(_utc(2026, 8, 15, 17), "week") == _utc(2026, 8, 10)


def test_truncate_to_bucket_week_leaves_monday_alone():
    assert truncate_to_bucket(_utc(2026, 8, 10, 9), "week") == _utc(2026, 8, 10)


def test_truncate_to_bucket_month_snaps_to_first():
    assert truncate_to_bucket(_utc(2026, 8, 15, 17), "month") == _utc(2026, 8, 1)


def test_truncate_to_bucket_converts_non_utc_input():
    ist = timezone(timedelta(hours=5, minutes=30))
    # 2026-08-16 04:00 IST is 2026-08-15 22:30 UTC, so it belongs to the 15th's bucket.
    assert truncate_to_bucket(datetime(2026, 8, 16, 4, 0, tzinfo=ist), "day") == _utc(2026, 8, 15)


def test_truncate_to_bucket_invalid_granularity_raises():
    with pytest.raises(ValueError):
        truncate_to_bucket(_utc(2026, 8, 15), "year")


def test_shift_bucket_day_back_across_month_boundary():
    assert shift_bucket(_utc(2026, 8, 2), "day", -3) == _utc(2026, 7, 30)


def test_shift_bucket_week_steps_seven_days():
    assert shift_bucket(_utc(2026, 8, 10), "week", -2) == _utc(2026, 7, 27)


def test_shift_bucket_month_back_across_year_boundary():
    assert shift_bucket(_utc(2026, 2, 1), "month", -3) == _utc(2025, 11, 1)


def test_shift_bucket_month_forward_across_december():
    assert shift_bucket(_utc(2026, 11, 1), "month", 2) == _utc(2027, 1, 1)


def test_shift_bucket_zero_is_identity():
    assert shift_bucket(_utc(2026, 8, 15), "day", 0) == _utc(2026, 8, 15)


def test_build_bucket_starts_is_oldest_first_and_ends_at_now():
    starts = build_bucket_starts("day", _utc(2026, 8, 15, 13), 4)
    assert starts == [_utc(2026, 8, 12), _utc(2026, 8, 13), _utc(2026, 8, 14), _utc(2026, 8, 15)]


def test_build_bucket_starts_month_walks_calendar_months():
    starts = build_bucket_starts("month", _utc(2026, 1, 20), 3)
    assert starts == [_utc(2025, 11, 1), _utc(2025, 12, 1), _utc(2026, 1, 1)]


def test_fill_trend_buckets_inserts_zero_points_for_gaps():
    buckets = build_bucket_starts("day", _utc(2026, 8, 15), 3)
    points = [TrendPoint(bucket_start=_utc(2026, 8, 15), trip_count=2, distance_meters=8000)]

    filled = fill_trend_buckets(points, buckets)

    assert [point.bucket_start for point in filled] == buckets
    assert [point.distance_meters for point in filled] == [0, 0, 8000]
    assert [point.trip_count for point in filled] == [0, 0, 2]
    assert filled[0].avg_driving_score is None


def test_fill_trend_buckets_drops_points_outside_the_window():
    buckets = build_bucket_starts("day", _utc(2026, 8, 15), 2)
    points = [
        TrendPoint(bucket_start=_utc(2026, 8, 1), trip_count=9, distance_meters=99000),
        TrendPoint(bucket_start=_utc(2026, 8, 14), trip_count=1, distance_meters=1000),
    ]

    filled = fill_trend_buckets(points, buckets)

    assert [point.distance_meters for point in filled] == [1000, 0]


def test_fill_trend_buckets_with_no_points_is_all_zeroes():
    buckets = build_bucket_starts("week", _utc(2026, 8, 15), 3)

    filled = fill_trend_buckets([], buckets)

    assert len(filled) == 3
    assert all(point.trip_count == 0 and point.distance_meters == 0 for point in filled)


def test_split_trend_window_returns_previous_then_current():
    points = [TrendPoint(bucket_start=_utc(2026, 8, day)) for day in range(1, 5)]

    previous, current = split_trend_window(points, 2)

    assert [point.bucket_start.day for point in previous] == [1, 2]
    assert [point.bucket_start.day for point in current] == [3, 4]
