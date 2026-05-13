from fastapi import APIRouter

from app.core.config import settings

router = APIRouter()


@router.get("/healthz")
async def healthz() -> dict:
    return {"status": "ok", "app": settings.app_name, "environment": settings.environment}

