from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.vehicle_catalog import VehicleCompanyRead
from app.services.vehicle_catalog_service import list_companies_with_models

router = APIRouter(prefix="/vehicle-catalog")


@router.get("", response_model=list[VehicleCompanyRead])
async def get_vehicle_catalog(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[VehicleCompanyRead]:
    companies = await list_companies_with_models(db)
    return [VehicleCompanyRead.model_validate(c) for c in companies]
