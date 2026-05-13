from fastapi import APIRouter

from app.routers.auth_router import router as auth_router
from app.routers.dashboard_router import router as dashboard_router
from app.routers.health import router as health_router
from app.routers.trips import router as trips_router
from app.routers.vehicles import router as vehicles_router

api_router = APIRouter()
api_router.include_router(auth_router, tags=["auth"])
api_router.include_router(dashboard_router, tags=["dashboard"])
api_router.include_router(health_router, tags=["health"])
api_router.include_router(vehicles_router, tags=["vehicles"])
api_router.include_router(trips_router, tags=["trips"])
