from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.vehicle_catalog import VehicleCompany


async def list_companies_with_models(db: AsyncSession) -> list[VehicleCompany]:
    result = await db.execute(
        select(VehicleCompany).options(selectinload(VehicleCompany.models)).order_by(VehicleCompany.name)
    )
    companies = list(result.scalars().all())
    for company in companies:
        company.models.sort(key=lambda model: model.name)
    return companies
