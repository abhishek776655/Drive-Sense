from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol, Sequence

from app.models.enums import TripState
from app.services.driving_event_detection_service import (
    HARSH_BRAKING_EVENT,
    OVERSPEED_EVENT,
    RAPID_ACCELERATION_EVENT,
)


@dataclass(frozen=True)
class TripInsight:
    rule_id: str
    category: str
    tone: str
    title: str
    message: str
    metric_label: str
    metric_value: str
    priority: int


class TripInsightEvent(Protocol):
    event_type: str


class TripInsightTrip(Protocol):
    state: TripState | str
    end_time: object | None
    duration_seconds: int
    idle_time_seconds: int
    fuel_used_liters: float | None
    distance_meters: float
    driving_score: int | None
    events: Sequence[TripInsightEvent]


def _event_count(events: Sequence[TripInsightEvent], event_type: str) -> int:
    return sum(1 for event in events if event.event_type == event_type)


def _format_duration(seconds: int) -> str:
    minutes = round(seconds / 60)
    if minutes < 60:
        return f"{minutes} min"
    hours, remaining_minutes = divmod(minutes, 60)
    return f"{hours} hr {remaining_minutes} min" if remaining_minutes else f"{hours} hr"


def _format_count(count: int) -> str:
    return f"{count} event" if count == 1 else f"{count} events"


def generate_trip_insights(trip: TripInsightTrip, *, limit: int = 3) -> list[TripInsight]:
    if trip.state != TripState.ended and trip.state != TripState.ended.value:
        return []
    if trip.end_time is None:
        return []

    events = list(trip.events)
    insights: list[TripInsight] = []

    overspeed_count = _event_count(events, OVERSPEED_EVENT)
    if overspeed_count:
        insights.append(
            TripInsight(
                rule_id="safety_overspeed",
                category="safety",
                tone="warning",
                title="Overspeeding detected",
                message="Keep speed below posted limits to reduce risk and improve trip consistency.",
                metric_label="Overspeed",
                metric_value=_format_count(overspeed_count),
                priority=100,
            )
        )

    harsh_brake_count = _event_count(events, HARSH_BRAKING_EVENT)
    if harsh_brake_count:
        insights.append(
            TripInsight(
                rule_id="safety_harsh_brake",
                category="safety",
                tone="warning",
                title="Harsh braking recorded",
                message="Leave more following distance where possible to smooth out sudden stops.",
                metric_label="Harsh brake",
                metric_value=_format_count(harsh_brake_count),
                priority=90,
            )
        )

    rapid_acceleration_count = _event_count(events, RAPID_ACCELERATION_EVENT)
    if rapid_acceleration_count:
        insights.append(
            TripInsight(
                rule_id="safety_rapid_acceleration",
                category="safety",
                tone="info",
                title="Rapid acceleration recorded",
                message="Ease into acceleration to keep the ride smoother and use less fuel.",
                metric_label="Rapid acceleration",
                metric_value=_format_count(rapid_acceleration_count),
                priority=70,
            )
        )

    idle_share = trip.idle_time_seconds / trip.duration_seconds if trip.duration_seconds > 0 else 0
    if trip.idle_time_seconds >= 300 and idle_share >= 0.2:
        insights.append(
            TripInsight(
                rule_id="efficiency_idle_time",
                category="efficiency",
                tone="info",
                title="High idle time",
                message="A large share of this trip was spent stopped; reducing idle time can improve efficiency.",
                metric_label="Idle time",
                metric_value=f"{_format_duration(trip.idle_time_seconds)} ({round(idle_share * 100)}%)",
                priority=80,
            )
        )

    if trip.fuel_used_liters is not None and trip.fuel_used_liters > 0:
        distance_km = float(trip.distance_meters or 0) / 1000
        mileage = distance_km / float(trip.fuel_used_liters)
        insights.append(
            TripInsight(
                rule_id="efficiency_fuel_summary",
                category="efficiency",
                tone="info",
                title="Fuel summary",
                message="Use this trip's mileage as a baseline for comparing similar routes.",
                metric_label="Mileage",
                metric_value=f"{mileage:.1f} km/l",
                priority=40,
            )
        )

    has_behavior_events = any(
        event.event_type in {HARSH_BRAKING_EVENT, OVERSPEED_EVENT, RAPID_ACCELERATION_EVENT}
        for event in events
    )
    if trip.driving_score is not None and trip.driving_score >= 85 and not has_behavior_events:
        insights.append(
            TripInsight(
                rule_id="success_clean_high_score",
                category="safety",
                tone="success",
                title="Clean high-score trip",
                message="No behavior events were detected and the trip score stayed high.",
                metric_label="Score",
                metric_value=str(trip.driving_score),
                priority=60,
            )
        )

    return sorted(insights, key=lambda insight: insight.priority, reverse=True)[:limit]
