# Backend Integration Tests

Place Docker-backed or locally provisioned backend integration tests in this directory.

Integration test modules must mark each test or module with:

```python
pytestmark = pytest.mark.integration
```

The default fast backend test command excludes this marker.
