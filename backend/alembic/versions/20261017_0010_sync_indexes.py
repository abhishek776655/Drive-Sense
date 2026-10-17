"""sync: index rows by owner and last change, for the phone's incremental pull

Revision ID: 20261017_0010
Revises: 20261017_0009
Create Date: 2026-10-17 00:00:03
"""
from __future__ import annotations

from alembic import op


revision = "20261017_0010"
down_revision = "20261017_0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index("ix_trips_user_updated", "trips", ["user_id", "updated_at", "id"])
    op.create_index("ix_vehicles_user_updated", "vehicles", ["user_id", "updated_at", "id"])


def downgrade() -> None:
    op.drop_index("ix_vehicles_user_updated", table_name="vehicles")
    op.drop_index("ix_trips_user_updated", table_name="trips")
