from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

from app.services.turn_detection_service import detect_turns, signed_delta

T0 = datetime(2026, 10, 11, 8, 0, tzinfo=timezone.utc)


def _track(headings, speed=10.0, step_seconds=1.0):
    return [
        SimpleNamespace(
            recorded_at=T0 + timedelta(seconds=i * step_seconds),
            latitude=28.6 + i * 0.0001,
            longitude=77.2,
            speed_mps=speed,
            heading_deg=heading,
        )
        for i, heading in enumerate(headings)
    ]


def test_signed_delta_takes_the_short_way_round():
    assert signed_delta(350, 10) == 20
    assert signed_delta(10, 350) == -20
    assert signed_delta(0, 90) == 90


def test_right_turn_through_north():
    counts = detect_turns(_track([300, 300, 320, 345, 10, 30, 30]))
    assert (counts.left, counts.right) == (0, 1)


def test_left_turn():
    counts = detect_turns(_track([90, 90, 60, 30, 0, 0]))
    assert (counts.left, counts.right) == (1, 0)


def test_a_slow_curve_over_more_than_eight_seconds_is_not_a_turn():
    counts = detect_turns(_track([0, 6, 12, 18, 24, 30, 36, 42, 48, 54, 60, 66], step_seconds=1.0))
    assert (counts.left, counts.right) == (0, 0)


def test_a_full_u_turn_counts_once_per_sixty_degrees_window():
    counts = detect_turns(_track([0, 45, 90, 135, 180]))
    assert counts.right == 2
    assert counts.left == 0


def test_parked_or_crawling_cars_do_not_turn():
    counts = detect_turns(_track([0, 90, 180, 270], speed=1.0))
    assert (counts.left, counts.right) == (0, 0)


def test_missing_course_falls_back_to_bearing_between_fixes():
    points = [
        SimpleNamespace(recorded_at=T0 + timedelta(seconds=i), latitude=lat, longitude=lon, speed_mps=10.0, heading_deg=None)
        for i, (lat, lon) in enumerate([(28.6, 77.2), (28.6001, 77.2), (28.6002, 77.2), (28.6002, 77.2001), (28.6002, 77.2002)])
    ]
    counts = detect_turns(points)
    assert (counts.left, counts.right) == (0, 1)


def test_a_long_gap_breaks_the_window():
    # 0° → 40°, then a 7 s gap with no fix, then 80°: no 60° change inside one unbroken window.
    points = _track([0, 40]) + [
        SimpleNamespace(recorded_at=T0 + timedelta(seconds=8), latitude=28.61, longitude=77.2, speed_mps=10.0, heading_deg=80),
    ]
    counts = detect_turns(points)
    assert (counts.left, counts.right) == (0, 0)
