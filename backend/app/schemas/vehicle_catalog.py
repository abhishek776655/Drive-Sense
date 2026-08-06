from __future__ import annotations

from uuid import UUID

from app.schemas.base import SchemaBase


class VehicleModelRead(SchemaBase):
    id: UUID
    name: str
    image_url: str | None


class VehicleCompanyRead(SchemaBase):
    id: UUID
    name: str
    models: list[VehicleModelRead]
