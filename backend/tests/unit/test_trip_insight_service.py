from __future__ import annotations

import unittest
from datetime import datetime, timezone
from types import SimpleNamespace

from app.models.enums import TripState
from app.services.trip_insight_service import generate_trip_insights


def make_trip(**overrides):
    values = {
        "state": TripState.ended,
        "end_time": datetime(2026, 5, 16, 10, 0, tzinfo=timezone.utc),
        "duration_seconds": 1800,
        "idle_time_seconds": 0,
        "fuel_used_liters": None,
        "distance_meters": 12000,
        "driving_score": 90,
        "events": [],
    }
    values.update(overrides)
    return SimpleNamespace(**values)


def event(event_type: str):
    return SimpleNamespace(event_type=event_type)


class GenerateTripInsightsTest(unittest.TestCase):
    def test_clean_high_score_trip_returns_success_insight(self):
        insights = generate_trip_insights(make_trip(driving_score=92, events=[]))

        self.assertEqual(["success_clean_high_score"], [insight.rule_id for insight in insights])
        self.assertEqual("success", insights[0].tone)

    def test_behavior_rules_rank_correctly(self):
        insights = generate_trip_insights(
            make_trip(
                events=[
                    event("rapid_acceleration"),
                    event("harsh_brake"),
                    event("overspeed"),
                ]
            )
        )

        self.assertEqual(
            ["safety_overspeed", "safety_harsh_brake", "safety_rapid_acceleration"],
            [insight.rule_id for insight in insights],
        )
        self.assertEqual(["warning", "warning", "info"], [insight.tone for insight in insights])

    def test_high_idle_trip_returns_efficiency_insight(self):
        insights = generate_trip_insights(make_trip(duration_seconds=1500, idle_time_seconds=360))

        idle_insight = next(insight for insight in insights if insight.rule_id == "efficiency_idle_time")
        self.assertEqual("efficiency", idle_insight.category)
        self.assertEqual("Idle time", idle_insight.metric_label)

    def test_active_trip_returns_no_insights(self):
        insights = generate_trip_insights(make_trip(state=TripState.active, end_time=None))

        self.assertEqual([], insights)

    def test_top_three_cap_is_enforced(self):
        insights = generate_trip_insights(
            make_trip(
                duration_seconds=1500,
                idle_time_seconds=360,
                fuel_used_liters=1.2,
                events=[
                    event("rapid_acceleration"),
                    event("harsh_brake"),
                    event("overspeed"),
                ],
            )
        )

        self.assertEqual(3, len(insights))
        self.assertEqual(
            ["safety_overspeed", "safety_harsh_brake", "efficiency_idle_time"],
            [insight.rule_id for insight in insights],
        )


if __name__ == "__main__":
    unittest.main()
