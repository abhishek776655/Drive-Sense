from sqlalchemy.dialects import postgresql

from app.services.trip_service import TRIP_SORTS, trip_sort_order


def _sql(clauses):
    return [str(c.compile(dialect=postgresql.dialect())) for c in clauses]


def test_every_sort_has_an_order():
    for sort in TRIP_SORTS:
        assert trip_sort_order(sort), sort


def test_newest_is_the_default_for_unknown_sorts():
    assert _sql(trip_sort_order("nonsense")) == _sql(trip_sort_order("newest"))


def test_score_sorts_put_unscored_trips_last():
    assert "NULLS LAST" in _sql(trip_sort_order("best"))[0]
    assert "NULLS LAST" in _sql(trip_sort_order("worst"))[0]


def test_ties_fall_back_to_newest():
    assert "trips.start_time DESC" in _sql(trip_sort_order("longest"))[-1]


from app.services.trip_service import thin_route  # noqa: E402


def test_thin_route_keeps_short_routes():
    pts = [(0.0, 0.0), (1.0, 1.0)]
    assert thin_route(pts, 40) == pts


def test_thin_route_keeps_ends_and_caps_length():
    pts = [(float(i), 0.0) for i in range(101)]
    assert thin_route(pts, 5) == [(0.0, 0.0), (25.0, 0.0), (50.0, 0.0), (75.0, 0.0), (100.0, 0.0)]
