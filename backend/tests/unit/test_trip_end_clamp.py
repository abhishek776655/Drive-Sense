from datetime import datetime, timezone

from app.services.trip_service import end_not_before_start


def _t(second: float) -> datetime:
    return datetime(2026, 10, 25, 10, 51, int(second), int((second % 1) * 1_000_000), tzinfo=timezone.utc)


def test_end_before_start_is_raised_to_the_start():
    # The failing row: last point 10:51:50.664, trip start 10:51:51.45.
    assert end_not_before_start(_t(50.664), _t(51.45)) == _t(51.45)


def test_later_end_is_kept():
    assert end_not_before_start(_t(59.0), _t(51.45)) == _t(59.0)


def test_naive_times_are_treated_as_utc():
    naive_start = datetime(2026, 10, 25, 10, 51, 51)
    assert end_not_before_start(_t(50.0), naive_start).tzinfo is not None
