import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.main import app
from app.services.profile_service import HandleTaken, handle_availability, handle_problem, normalize_handle, set_handle


def _db(owner):
    result = MagicMock()
    result.scalar_one_or_none.return_value = owner
    db = MagicMock()
    db.execute = AsyncMock(return_value=result)
    db.commit = AsyncMock()
    db.rollback = AsyncMock()
    return db


def test_handles_are_normalised_and_checked():
    assert normalize_handle("  @Lazarus ") == "lazarus"
    assert handle_problem("ab") == "At least 3 characters"
    assert handle_problem("a" * 21) == "At most 20 characters"
    assert handle_problem("hi there") == "Letters, numbers and _ only"
    assert handle_problem("road_runner_7") is None


async def test_availability_reports_taken_but_not_for_your_own_handle():
    me, other = uuid.uuid4(), uuid.uuid4()
    assert await handle_availability(_db(other), user_id=me, raw="@Lazarus") == ("lazarus", False, "taken")
    assert await handle_availability(_db(me), user_id=me, raw="lazarus") == ("lazarus", True, None)
    assert await handle_availability(_db(None), user_id=me, raw="x!") == ("x!", False, "At least 3 characters")


async def test_set_handle_saves_or_refuses():
    user = SimpleNamespace(id=uuid.uuid4(), handle=None)
    db = _db(None)
    await set_handle(db, user=user, raw="@Road_Runner")
    assert user.handle == "road_runner"
    db.commit.assert_awaited_once()
    with pytest.raises(HandleTaken):
        await set_handle(_db(uuid.uuid4()), user=user, raw="taken_one")
    with pytest.raises(ValueError):
        await set_handle(_db(None), user=user, raw="no")


def test_profile_routes_are_registered():
    paths = {(route.path, method) for route in app.routes for method in getattr(route, "methods", set())}
    for path, method in [("/api/v1/auth/handle-available", "GET"), ("/api/v1/auth/me", "PATCH"), ("/api/v1/auth/me/avatar", "PUT"), ("/api/v1/auth/me/avatar", "GET")]:
        assert (path, method) in paths
