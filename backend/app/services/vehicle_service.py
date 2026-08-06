from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.vehicle import Vehicle
from app.models.vehicle_catalog import VehicleModel
from app.schemas.vehicle import VehicleCreate, VehicleUpdate

_VEHICLE_LOAD_OPTIONS = (selectinload(Vehicle.model).selectinload(VehicleModel.company),)


async def list_vehicles(db: AsyncSession, *, user_id: uuid.UUID) -> list[Vehicle]:
    result = await db.execute(
        select(Vehicle)
        .where(Vehicle.user_id == user_id, Vehicle.deleted_at.is_(None))
        .options(*_VEHICLE_LOAD_OPTIONS)
    )
    return list(result.scalars().all())


async def get_vehicle(db: AsyncSession, *, user_id: uuid.UUID, vehicle_id: uuid.UUID) -> Vehicle | None:
    result = await db.execute(
        select(Vehicle)
        .where(Vehicle.id == vehicle_id, Vehicle.user_id == user_id, Vehicle.deleted_at.is_(None))
        .options(*_VEHICLE_LOAD_OPTIONS)
    )
    return result.scalar_one_or_none()


async def create_vehicle(db: AsyncSession, *, user_id: uuid.UUID, data: VehicleCreate) -> Vehicle:
    vehicle = Vehicle(
        user_id=user_id,
        model_id=data.model_id,
        name=data.nickname,
        plate_number=data.plate_number,
        fuel_type=data.fuel_type,
        tank_capacity_liters=data.tank_capacity_liters,
        mileage_baseline_km_per_l=data.mileage_baseline_km_per_l,
    )
    db.add(vehicle)
    await db.commit()
    result = await db.execute(select(Vehicle).where(Vehicle.id == vehicle.id).options(*_VEHICLE_LOAD_OPTIONS))
    return result.scalar_one()


async def update_vehicle(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    vehicle_id: uuid.UUID,
    data: VehicleUpdate,
) -> Vehicle | None:
    vehicle = await get_vehicle(db, user_id=user_id, vehicle_id=vehicle_id)
    if vehicle is None:
        return None

    updates = data.model_dump(exclude_unset=True)
    if "nickname" in updates:
        updates["name"] = updates.pop("nickname")
    for key, value in updates.items():
        setattr(vehicle, key, value)

    await db.commit()
    result = await db.execute(select(Vehicle).where(Vehicle.id == vehicle.id).options(*_VEHICLE_LOAD_OPTIONS))
    return result.scalar_one()


async def delete_vehicle(db: AsyncSession, *, user_id: uuid.UUID, vehicle_id: uuid.UUID) -> bool:
    vehicle = await get_vehicle(db, user_id=user_id, vehicle_id=vehicle_id)
    if vehicle is None:
        return False
    vehicle.deleted_at = datetime.now(timezone.utc)
    await db.commit()
    return True
