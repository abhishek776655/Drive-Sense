"""add vehicle plate number

Revision ID: 20260513_0001
Revises: 
Create Date: 2026-05-13 00:00:00
"""
from __future__ import annotations

from alembic import op


revision = "20260513_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS citext")
    op.execute("ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS plate_number TEXT")


def downgrade() -> None:
    op.execute("ALTER TABLE vehicles DROP COLUMN IF EXISTS plate_number")
