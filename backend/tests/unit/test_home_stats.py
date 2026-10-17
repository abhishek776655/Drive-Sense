from datetime import date, datetime, timedelta, timezone
from types import SimpleNamespace

from app.services.g_force_service import estimate_max_g_from_speeds, merge_sensor_peak
from app.services.home_stats_service import compute_streak, resolve_zone, score_delta

TODAY = date(2026, 10, 11)


def test_streak_counts_consecutive_days_ending_today():
    assert compute_streak({TODAY, TODAY - timedelta(days=1), TODAY - timedelta(days=2)}, TODAY) == 3


def test_streak_survives_until_the_day_after_the_last_drive():
    assert compute_streak({TODAY - timedelta(days=1), TODAY - timedelta(days=2)}, TODAY) == 2


def test_streak_breaks_after_a_missed_day():
    assert compute_streak({TODAY - timedelta(days=2)}, TODAY) == 0
    assert compute_streak({TODAY, TODAY - timedelta(days=2)}, TODAY) == 1
    assert compute_streak(set(), TODAY) == 0


def test_score_delta_needs_both_windows():
    assert score_delta(88.0, 80.0) == 8.0
    assert score_delta(88.0, None) is None
    assert score_delta(None, 80.0) is None


def test_unknown_zone_falls_back_to_utc():
    assert resolve_zone("Not/AZone").key == "UTC"
    assert resolve_zone(None).key == "UTC"
    assert resolve_zone("Asia/Kolkata").key == "Asia/Kolkata"


T0 = datetime(2026, 10, 11, 8, 0, tzinfo=timezone.utc)


def _point(seconds: float, speed: float | None):
    return SimpleNamespace(recorded_at=T0 + timedelta(seconds=seconds), speed_mps=speed)


def test_gps_estimate_takes_the_hardest_brake_or_launch():
    # 20 -> 15 m/s in 1 s is a 5 m/s² brake, about 0.51 g.
    points = [_point(0, 10), _point(1, 13), _point(2, 20), _point(3, 15)]
    assert abs(estimate_max_g_from_speeds(points) - 7 / 9.81) < 1e-9


def test_gps_estimate_ignores_gaps_noise_and_missing_speeds():
    assert estimate_max_g_from_speeds([_point(0, 0), _point(10, 30)]) is None  # gap too long
    assert estimate_max_g_from_speeds([_point(0, 0), _point(1, 30)]) is None  # implausible jump
    assert estimate_max_g_from_speeds([_point(0, None), _point(1, 5)]) is None
    assert estimate_max_g_from_speeds([]) is None
    assert estimate_max_g_from_speeds([_point(0, 14), _point(1, 14), _point(2, 14)]) is None  # cruising


def test_sensor_peak_keeps_the_trip_maximum():
    assert merge_sensor_peak(None, [0.2, None, 0.4]) == 0.4
    assert merge_sensor_peak(0.5, [0.2]) == 0.5
    assert merge_sensor_peak(0.3, [None]) == 0.3
