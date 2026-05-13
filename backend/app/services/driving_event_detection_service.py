from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import Sequence

HARSH_BRAKING_EVENT = "harsh_brake"
RAPID_ACCELERATION_EVENT = "rapid_acceleration"
OVERSPEED_EVENT = "overspeed"


@dataclass(frozen=True)
class DrivingEventThresholds:
    harsh_braking_mps2: float = -3.5
    rapid_acceleration_mps2: float = 3.0
    overspeed_mps: float = 27.78


@dataclass(frozen=True)
class DetectionPoint:
    recorded_at: datetime
    latitude: float
    longitude: float
    speed_mps: float | None


@dataclass(frozen=True)
class DetectedDrivingEvent:
    event_type: str
    intensity: float
    occurred_at: datetime
    latitude: float
    longitude: float
    payload: dict


DEFAULT_DRIVING_EVENT_THRESHOLDS = DrivingEventThresholds()


def _normalize_intensity(raw_intensity: float) -> float:
    return max(0.0, round(raw_intensity, 3))


def _build_acceleration_event(
    *,
    event_type: str,
    threshold_mps2: float,
    acceleration_mps2: float,
    point: DetectionPoint,
    previous_point: DetectionPoint,
    delta_seconds: float,
) -> DetectedDrivingEvent:
    if event_type == HARSH_BRAKING_EVENT:
        intensity = _normalize_intensity(abs(acceleration_mps2) / abs(threshold_mps2))
    else:
        intensity = _normalize_intensity(acceleration_mps2 / threshold_mps2)

    return DetectedDrivingEvent(
        event_type=event_type,
        intensity=intensity,
        occurred_at=point.recorded_at,
        latitude=point.latitude,
        longitude=point.longitude,
        payload={
            "threshold_mps2": threshold_mps2,
            "acceleration_mps2": round(acceleration_mps2, 3),
            "speed_mps": point.speed_mps,
            "previous_speed_mps": previous_point.speed_mps,
            "delta_seconds": round(delta_seconds, 3),
        },
    )


def detect_driving_events(
    points: Sequence[DetectionPoint],
    *,
    thresholds: DrivingEventThresholds = DEFAULT_DRIVING_EVENT_THRESHOLDS,
    baseline_included: bool = False,
) -> list[DetectedDrivingEvent]:
    if not points:
        return []

    ordered_points = sorted(points, key=lambda point: point.recorded_at)
    detected_events: list[DetectedDrivingEvent] = []
    previous_point: DetectionPoint | None = None
    start_index = 0
    was_overspeeding = False

    if baseline_included:
        previous_point = ordered_points[0]
        was_overspeeding = (
            previous_point.speed_mps is not None and previous_point.speed_mps > thresholds.overspeed_mps
        )
        start_index = 1

    for point in ordered_points[start_index:]:
        if point.speed_mps is not None:
            is_overspeeding = point.speed_mps > thresholds.overspeed_mps
            if is_overspeeding and not was_overspeeding:
                intensity = _normalize_intensity(point.speed_mps / thresholds.overspeed_mps)
                detected_events.append(
                    DetectedDrivingEvent(
                        event_type=OVERSPEED_EVENT,
                        intensity=intensity,
                        occurred_at=point.recorded_at,
                        latitude=point.latitude,
                        longitude=point.longitude,
                        payload={
                            "threshold_mps": thresholds.overspeed_mps,
                            "speed_mps": point.speed_mps,
                            "speed_kph": round(point.speed_mps * 3.6, 2),
                        },
                    )
                )
            was_overspeeding = is_overspeeding

        if previous_point is None:
            previous_point = point
            continue

        if previous_point.speed_mps is None or point.speed_mps is None:
            previous_point = point
            continue

        delta_seconds = (point.recorded_at - previous_point.recorded_at).total_seconds()
        if delta_seconds <= 0:
            previous_point = point
            continue

        acceleration_mps2 = (point.speed_mps - previous_point.speed_mps) / delta_seconds
        if acceleration_mps2 <= thresholds.harsh_braking_mps2:
            detected_events.append(
                _build_acceleration_event(
                    event_type=HARSH_BRAKING_EVENT,
                    threshold_mps2=thresholds.harsh_braking_mps2,
                    acceleration_mps2=acceleration_mps2,
                    point=point,
                    previous_point=previous_point,
                    delta_seconds=delta_seconds,
                )
            )
        elif acceleration_mps2 >= thresholds.rapid_acceleration_mps2:
            detected_events.append(
                _build_acceleration_event(
                    event_type=RAPID_ACCELERATION_EVENT,
                    threshold_mps2=thresholds.rapid_acceleration_mps2,
                    acceleration_mps2=acceleration_mps2,
                    point=point,
                    previous_point=previous_point,
                    delta_seconds=delta_seconds,
                )
            )

        previous_point = point

    return detected_events


def serialize_detected_events(trip_id, events: Sequence[DetectedDrivingEvent]) -> list[dict]:
    payload: list[dict] = []
    for event in events:
        payload.append(
            {
                "trip_id": trip_id,
                "event_type": event.event_type,
                "intensity": Decimal(str(event.intensity)),
                "occurred_at": event.occurred_at,
                "latitude": event.latitude,
                "longitude": event.longitude,
                "payload": event.payload,
            }
        )
    return payload
