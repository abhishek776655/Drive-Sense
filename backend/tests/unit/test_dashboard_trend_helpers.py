from __future__ import annotations

import pytest

from app.services.dashboard_service import resolve_trend_lookback_days


def test_resolve_trend_lookback_days_day():
    assert resolve_trend_lookback_days("day") == 30


def test_resolve_trend_lookback_days_week():
    assert resolve_trend_lookback_days("week") == 84


def test_resolve_trend_lookback_days_month():
    assert resolve_trend_lookback_days("month") == 365


def test_resolve_trend_lookback_days_invalid_raises():
    with pytest.raises(KeyError):
        resolve_trend_lookback_days("year")
