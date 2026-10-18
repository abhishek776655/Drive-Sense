from __future__ import annotations

import base64
import binascii
import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.vehicle import Vehicle
from app.models.vehicle_catalog import VehicleCompany, VehicleModel
from app.schemas.vehicle import VehicleCreate, VehicleUpdate

_VEHICLE_LOAD_OPTIONS = (selectinload(Vehicle.model).selectinload(VehicleModel.company),)


async def list_vehicles(db: AsyncSession, *, user_id: uuid.UUID) -> list[Vehicle]:
    result = await db.execute(
        select(Vehicle)
        .where(Vehicle.user_id == user_id, Vehicle.deleted_at.is_(None))
        .options(*_VEHICLE_LOAD_OPTIONS)
        # In the order they were added (the Garage strip), whatever was edited since.
        .order_by(Vehicle.created_at, Vehicle.id)
    )
    return list(result.scalars().all())


async def get_vehicle(db: AsyncSession, *, user_id: uuid.UUID, vehicle_id: uuid.UUID) -> Vehicle | None:
    result = await db.execute(
        select(Vehicle)
        .where(Vehicle.id == vehicle_id, Vehicle.user_id == user_id, Vehicle.deleted_at.is_(None))
        .options(*_VEHICLE_LOAD_OPTIONS)
    )
    return result.scalar_one_or_none()


async def find_or_create_model(db: AsyncSession, *, make: str, model: str) -> uuid.UUID:
    """The catalog model for a typed make and model, matched case-insensitively, created when new."""
    make, model = " ".join(make.split()), " ".join(model.split())
    company = (
        await db.execute(select(VehicleCompany).where(func.lower(VehicleCompany.name) == make.lower()))
    ).scalar_one_or_none()
    if company is None:
        company = VehicleCompany(name=make)
        db.add(company)
        await db.flush()
    found = (
        await db.execute(
            select(VehicleModel).where(VehicleModel.company_id == company.id, func.lower(VehicleModel.name) == model.lower())
        )
    ).scalar_one_or_none()
    if found is None:
        found = VehicleModel(company_id=company.id, name=model)
        db.add(found)
        await db.flush()
    return found.id


async def create_vehicle(db: AsyncSession, *, user_id: uuid.UUID, data: VehicleCreate) -> Vehicle:
    model_id = data.model_id
    if model_id is None:
        model_id = await find_or_create_model(db, make=data.make or "", model=data.model or "")
    vehicle = Vehicle(
        user_id=user_id,
        model_id=model_id,
        name=data.nickname,
        plate_number=data.plate_number,
        fuel_type=data.fuel_type,
        tank_capacity_liters=data.tank_capacity_liters,
        mileage_baseline_km_per_l=data.mileage_baseline_km_per_l,
        vehicle_type=data.vehicle_type,
        year=data.year,
        horsepower=data.horsepower,
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
    make, model = updates.pop("make", None), updates.pop("model", None)
    if make and model:
        updates["model_id"] = await find_or_create_model(db, make=make, model=model)
    if "nickname" in updates:
        updates["name"] = updates.pop("nickname")
    for key, value in updates.items():
        setattr(vehicle, key, value)

    await db.commit()
    # populate_existing: the session keeps objects after commit, and a new make/model must reload.
    result = await db.execute(
        select(Vehicle)
        .where(Vehicle.id == vehicle.id)
        .options(*_VEHICLE_LOAD_OPTIONS)
        .execution_options(populate_existing=True)
    )
    return result.scalar_one()


async def delete_vehicle(db: AsyncSession, *, user_id: uuid.UUID, vehicle_id: uuid.UUID) -> bool:
    vehicle = await get_vehicle(db, user_id=user_id, vehicle_id=vehicle_id)
    if vehicle is None:
        return False
    vehicle.deleted_at = datetime.now(timezone.utc)
    await db.commit()
    return True


MAX_PHOTO_BYTES = 2_500_000


def decode_photo(data: str) -> tuple[bytes, str]:
    """Bytes and media type of an uploaded photo; ValueError unless it is a JPEG or PNG under the cap."""
    try:
        raw = base64.b64decode(data, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ValueError("Photo is not valid base64") from exc
    if len(raw) > MAX_PHOTO_BYTES:
        raise ValueError("Photo is too large")
    if raw.startswith(b"\xff\xd8\xff"):
        return raw, "image/jpeg"
    if raw.startswith(b"\x89PNG\r\n\x1a\n"):
        return raw, "image/png"
    raise ValueError("Photo must be a JPEG or PNG")


def photo_media_type(raw: bytes) -> str:
    return "image/png" if raw.startswith(b"\x89PNG") else "image/jpeg"


async def set_vehicle_photo(
    db: AsyncSession, *, user_id: uuid.UUID, vehicle_id: uuid.UUID, photo: bytes | None
) -> Vehicle | None:
    """Stores (or with None, removes) the vehicle's photo; None when the vehicle is not the user's."""
    vehicle = await get_vehicle(db, user_id=user_id, vehicle_id=vehicle_id)
    if vehicle is None:
        return None
    vehicle.photo = photo
    vehicle.photo_updated_at = datetime.now(timezone.utc) if photo is not None else None
    await db.commit()
    return vehicle


async def get_vehicle_photo(db: AsyncSession, *, user_id: uuid.UUID, vehicle_id: uuid.UUID) -> bytes | None:
    result = await db.execute(
        select(Vehicle.photo).where(Vehicle.id == vehicle_id, Vehicle.user_id == user_id, Vehicle.deleted_at.is_(None))
    )
    return result.scalar_one_or_none()
