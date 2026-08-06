from app.services.driving_score_service import DrivingScoreInput, calculate_driving_score


def test_calculate_driving_score_penalizes_events_by_weight():
    score = calculate_driving_score(
        DrivingScoreInput(
            harsh_brake_count=2,
            harsh_acceleration_count=2,
            overspeed_duration_seconds=30,
        )
    )

    assert score == 90


def test_calculate_driving_score_clamps_to_zero():
    score = calculate_driving_score(
        DrivingScoreInput(
            harsh_brake_count=80,
            harsh_acceleration_count=80,
            overspeed_duration_seconds=500,
        )
    )

    assert score == 0
