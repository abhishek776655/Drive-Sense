import pytest

pytestmark = pytest.mark.integration


@pytest.mark.skip(reason="Integration suite is reserved for Phase 2 Docker-backed tests.")
def test_integration_suite_placeholder():
    pass
