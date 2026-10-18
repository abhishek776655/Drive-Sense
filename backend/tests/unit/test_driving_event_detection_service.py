from datetime import datetime, timedelta, timezone

from app.services.driving_event_detection_service import (
    HARSH_BRAKING_EVENT,
    OVERSPEED_EVENT,
    RAPID_ACCELERATION_EVENT,
    DetectionPoint,
    DrivingEventThresholds,
    detect_driving_events,
)


def point(offset_seconds: int, speed_mps: float) -> DetectionPoint:
    return DetectionPoint(
        recorded_at=datetime(2026, 5, 16, 10, 0, tzinfo=timezone.utc) + timedelta(seconds=offset_seconds),
        latitude=12.9716,
        longitude=77.5946,
        speed_mps=speed_mps,
    )


def test_detect_driving_events_reports_speed_and_acceleration_events():
    events = detect_driving_events(
        [
            point(0, 5),
            point(5, 25),
            point(10, 8),
            point(15, 33),
        ],
        thresholds=DrivingEventThresholds(
            harsh_braking_mps2=-3,
            rapid_acceleration_mps2=3,
            overspeed_mps=30,
        ),
    )

    assert [event.event_type for event in events] == [
        RAPID_ACCELERATION_EVENT,
        HARSH_BRAKING_EVENT,
        OVERSPEED_EVENT,
        RAPID_ACCELERATION_EVENT,
    ]
    assert events[0].payload["previous_speed_mps"] == 5
    assert events[2].payload["speed_kph"] == 118.8


def _track_point(seconds: float, north_m: float, east_m: float, speed: float):
    from datetime import datetime, timedelta, timezone
    from math import cos, radians

    from app.services.driving_event_detection_service import DetectionPoint

    return DetectionPoint(
        recorded_at=datetime(2026, 10, 18, 9, 0, tzinfo=timezone.utc) + timedelta(seconds=seconds),
        latitude=28.6 + north_m / 111_195,
        longitude=77.2 + east_m / (111_195 * cos(radians(28.6))),
        speed_mps=speed,
    )


def test_a_hard_right_turn_is_one_sharp_turn_at_its_sharpest_point():
    from app.services.driving_event_detection_service import detect_sharp_turns

    # North at 12 m/s, then a right angle into east within a couple of seconds.
    track = [_track_point(i, 12 * i, 0, 12) for i in range(6)]
    track += [_track_point(5 + i, 60, 12 * i, 12) for i in range(1, 7)]
    events = detect_sharp_turns(track)
    assert len(events) == 1
    assert events[0].event_type == "sharp_turn"
    assert events[0].payload["direction"] == "right"
    assert events[0].intensity >= 1


def test_a_straight_road_and_a_gentle_bend_are_not_sharp():
    from app.services.driving_event_detection_service import detect_sharp_turns

    straight = [_track_point(i, 15 * i, 0.8 * (i % 2), 15) for i in range(20)]
    assert detect_sharp_turns(straight) == []
    # 30 degrees spread over 10 s at 10 m/s: about 0.5 m/s².
    from math import cos, radians, sin

    bend, north, east = [], 0.0, 0.0
    for i in range(20):
        heading = radians(min(30, max(0, (i - 5) * 3)))
        north += 10 * cos(heading)
        east += 10 * sin(heading)
        bend.append(_track_point(i, north, east, 10))
    assert detect_sharp_turns(bend) == []


def test_slow_turns_do_not_count():
    from app.services.driving_event_detection_service import detect_sharp_turns

    track = [_track_point(i, 3 * i, 0, 3) for i in range(6)]
    track += [_track_point(5 + i, 15, 3 * i, 3) for i in range(1, 7)]
    assert detect_sharp_turns(track) == []


def test_sharp_turns_cost_a_point_each():
    from app.services.driving_score_service import DrivingScoreInput, calculate_driving_score

    assert calculate_driving_score(DrivingScoreInput(sharp_turn_count=3)) == 97
