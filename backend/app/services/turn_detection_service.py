"""Left and right turns from a trip's GPS track.

A turn is a signed change of direction of at least TURN_MIN_DEGREES within TURN_WINDOW_SECONDS while
moving. Direction comes from the phone's GPS course, or from the bearing between fixes when the
course is missing. Constants live here so they can be tuned against real trips in one place.
"""
from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime
from math import atan2, cos, degrees, radians, sin, sqrt
from typing import Protocol

TURN_MIN_DEGREES = 60.0
TURN_WINDOW_SECONDS = 8.0
# Below this the GPS course swings on noise (parking, crawling).
MOVING_MIN_MPS = 3.0
# Bearing between fixes needs this much movement to mean anything.
BEARING_MIN_STEP_M = 4.0
# A gap longer than this breaks the track: no turn is measured across it.
MAX_GAP_SECONDS = 5.0


class TrackPoint(Protocol):
    recorded_at: datetime
    latitude: float
    longitude: float
    speed_mps: float | None
    heading_deg: float | None


@dataclass(frozen=True)
class TurnCounts:
    left: int
    right: int


def _distance_m(a: TrackPoint, b: TrackPoint) -> float:
    lat1, lat2 = radians(a.latitude), radians(b.latitude)
    dlat = lat2 - lat1
    dlon = radians(b.longitude - a.longitude)
    h = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
    return 2 * 6_371_000 * atan2(sqrt(h), sqrt(1 - h))


def _bearing(a: TrackPoint, b: TrackPoint) -> float:
    lat1, lat2 = radians(a.latitude), radians(b.latitude)
    dlon = radians(b.longitude - a.longitude)
    y = sin(dlon) * cos(lat2)
    x = cos(lat1) * sin(lat2) - sin(lat1) * cos(lat2) * cos(dlon)
    return degrees(atan2(y, x)) % 360


def signed_delta(previous: float, current: float) -> float:
    """Shortest signed turn from `previous` to `current` in degrees; positive is clockwise (right)."""
    return (current - previous + 540) % 360 - 180


def _headings(points: Sequence[TrackPoint]) -> list[tuple[datetime, float | None, bool]]:
    """(time, heading, moving) per point; heading is None when it cannot be known."""
    result: list[tuple[datetime, float | None, bool]] = []
    for index, point in enumerate(points):
        moving = (point.speed_mps or 0) >= MOVING_MIN_MPS
        heading = point.heading_deg if point.heading_deg is not None and 0 <= point.heading_deg <= 360 else None
        if heading is None and index > 0 and _distance_m(points[index - 1], point) >= BEARING_MIN_STEP_M:
            heading = _bearing(points[index - 1], point)
        result.append((point.recorded_at, heading, moving))
    return result


def detect_turns(points: Sequence[TrackPoint]) -> TurnCounts:
    """Count turns. Each change of direction is counted once: after a turn the window restarts."""
    left = right = 0
    window: list[tuple[datetime, float]] = []  # (time, signed delta) since the window started
    previous: tuple[datetime, float] | None = None

    for time, heading, moving in _headings(points):
        if heading is None or not moving:
            previous, window = None, []
            continue
        if previous is not None and (time - previous[0]).total_seconds() > MAX_GAP_SECONDS:
            window = []
        if previous is not None:
            window.append((time, signed_delta(previous[1], heading)))
            while window and (time - window[0][0]).total_seconds() > TURN_WINDOW_SECONDS:
                window.pop(0)
            total = sum(delta for _, delta in window)
            if abs(total) >= TURN_MIN_DEGREES:
                if total > 0:
                    right += 1
                else:
                    left += 1
                window = []
        previous = (time, heading)

    return TurnCounts(left=left, right=right)
