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
