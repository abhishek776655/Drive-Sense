from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import Field

from app.schemas.base import SchemaBase


class UserCreate(SchemaBase):
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=8, max_length=256)


class UserRead(SchemaBase):
    id: UUID
    email: str
    created_at: datetime
