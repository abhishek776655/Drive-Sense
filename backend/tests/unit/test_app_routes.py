from app.main import app


def test_app_builds_with_every_route():
    """Importing the app registers every router; a bad route declaration fails here, not at deploy."""
    paths = {(route.path, method) for route in app.routes for method in getattr(route, "methods", set())}
    assert ("/api/v1/trips/{trip_id}", "DELETE") in paths
    assert ("/api/v1/trips/{trip_id}", "PATCH") in paths


def test_routes_endpoint_is_declared_before_the_trip_id_route():
    """Otherwise GET /trips/routes is read as a trip with id 'routes'."""
    ordered = [route.path for route in app.routes if "GET" in getattr(route, "methods", set())]
    assert ordered.index("/api/v1/trips/routes") < ordered.index("/api/v1/trips/{trip_id}")
