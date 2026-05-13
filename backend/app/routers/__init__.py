from app.routers.auth_router import router as auth_router
from app.routers.dashboard_router import router as dashboard_router
from app.routers.health import router as health_router
from app.routers.trips import router as trips_router
from app.routers.vehicles import router as vehicles_router

__all__ = ["auth_router", "dashboard_router", "health_router", "trips_router", "vehicles_router"]
