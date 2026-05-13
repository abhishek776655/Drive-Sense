from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class SchemaBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class UUIDSchema(SchemaBase):
    id: UUID


class TimestampsSchema(SchemaBase):
    created_at: datetime
    updated_at: datetime

