from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.dashboard import HomeStats
from app.schemas.vehicle import VehicleCreate, VehiclePhotoUpload, VehicleRead, VehicleUpdate
from app.services.home_stats_service import get_home_stats
from app.services.vehicle_service import (
    create_vehicle,
    decode_photo,
    delete_vehicle,
    get_vehicle,
    get_vehicle_photo,
    list_vehicles,
    photo_media_type,
    set_vehicle_photo,
    update_vehicle,
)

router = APIRouter(prefix="/vehicles")


@router.get("", response_model=list[VehicleRead])
async def get_vehicles(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[VehicleRead]:
    vehicles = await list_vehicles(db, user_id=user.id)
    return [VehicleRead.model_validate(v) for v in vehicles]


@router.get("/{vehicle_id}/home-stats", response_model=HomeStats)
async def get_vehicle_home_stats(
    vehicle_id: UUID,
    tz: str | None = Query(default=None, max_length=64, description="IANA time zone for the streak, e.g. Asia/Kolkata"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> HomeStats:
    if await get_vehicle(db, user_id=user.id, vehicle_id=vehicle_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vehicle not found")
    return await get_home_stats(db, user_id=user.id, tz=tz, vehicle_id=vehicle_id, frequency=user.driving_frequency)


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


@router.get("/{vehicle_id}/photo", response_class=Response)
async def get_photo(
    vehicle_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    photo = await get_vehicle_photo(db, user_id=user.id, vehicle_id=vehicle_id)
    if photo is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Photo not found")
    # The URL carries a version, so a cached copy never goes stale.
    return Response(content=photo, media_type=photo_media_type(photo), headers={"Cache-Control": "private, max-age=31536000, immutable"})


@router.put("/{vehicle_id}/photo", response_model=VehicleRead)
async def put_photo(
    vehicle_id: UUID,
    payload: VehiclePhotoUpload,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> VehicleRead:
    try:
        raw, _ = decode_photo(payload.data)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    vehicle = await set_vehicle_photo(db, user_id=user.id, vehicle_id=vehicle_id, photo=raw)
    if vehicle is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vehicle not found")
    return VehicleRead.model_validate(vehicle)


@router.delete("/{vehicle_id}/photo", response_model=VehicleRead)
async def delete_photo(
    vehicle_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> VehicleRead:
    vehicle = await set_vehicle_photo(db, user_id=user.id, vehicle_id=vehicle_id, photo=None)
    if vehicle is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vehicle not found")
    return VehicleRead.model_validate(vehicle)
