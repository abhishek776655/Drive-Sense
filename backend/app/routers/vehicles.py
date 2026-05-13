from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.vehicle import VehicleCreate, VehicleRead, VehicleUpdate
from app.services.vehicle_service import create_vehicle, delete_vehicle, list_vehicles, update_vehicle

router = APIRouter(prefix="/vehicles")


@router.get("", response_model=list[VehicleRead])
async def get_vehicles(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[VehicleRead]:
    vehicles = await list_vehicles(db, user_id=user.id)
    return [VehicleRead.model_validate(v) for v in vehicles]


@router.post("", response_model=VehicleRead, status_code=201)
async def post_vehicle(
    payload: VehicleCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> VehicleRead:
    vehicle = await create_vehicle(db, user_id=user.id, data=payload)
    return VehicleRead.model_validate(vehicle)


@router.put("/{vehicle_id}", response_model=VehicleRead)
async def put_vehicle(
    vehicle_id: UUID,
    payload: VehicleUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> VehicleRead:
    vehicle = await update_vehicle(db, user_id=user.id, vehicle_id=vehicle_id, data=payload)
    if vehicle is None:
        # 404 for "not found" and "not owned" to avoid leaking existence
        from fastapi import HTTPException, status

        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vehicle not found")
    return VehicleRead.model_validate(vehicle)


@router.delete("/{vehicle_id}", status_code=204, response_model=None)
async def delete_vehicle_by_id(
    vehicle_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    ok = await delete_vehicle(db, user_id=user.id, vehicle_id=vehicle_id)
    if not ok:
        from fastapi import HTTPException, status

        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vehicle not found")
