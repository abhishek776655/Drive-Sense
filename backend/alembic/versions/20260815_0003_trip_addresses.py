"""add reverse-geocoded start/end addresses to trips

Revision ID: 20260815_0003
Revises: 20260801_0002
Create Date: 2026-08-15 00:00:00
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "20260815_0003"
down_revision = "20260801_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("trips", sa.Column("start_address", sa.String(length=255), nullable=True))
    op.add_column("trips", sa.Column("end_address", sa.String(length=255), nullable=True))
    op.add_column("trips", sa.Column("geocoded_at", sa.DateTime(timezone=True), nullable=True))
    # Partial index over the backfill's working set: ended trips never put through geocoding. It
    # stays tiny because rows leave it as soon as they are attempted.
    op.create_index(
        "trips_pending_geocode_idx",
        "trips",
        ["end_time"],
        postgresql_where=sa.text("(geocoded_at IS NULL AND deleted_at IS NULL AND end_time IS NOT NULL)"),
    )


def downgrade() -> None:
    op.drop_index("trips_pending_geocode_idx", table_name="trips")
    op.drop_column("trips", "geocoded_at")
    op.drop_column("trips", "end_address")
    op.drop_column("trips", "start_address")
