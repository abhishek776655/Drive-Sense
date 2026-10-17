"""store peak G-force per location point and the per-trip maximum

Revision ID: 20261011_0004
Revises: 20260815_0003
Create Date: 2026-10-11 00:00:00
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "20261011_0004"
down_revision = "20260815_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Peak horizontal acceleration (in g) the phone's motion sensor saw since the previous fix.
    op.add_column("location_points", sa.Column("peak_g", sa.Float(), nullable=True))
    op.add_column("trips", sa.Column("max_g_force", sa.Float(), nullable=True))
    # 'sensor' (from peak_g) or 'gps' (estimated from speed changes when no sensor data arrived).
    op.add_column("trips", sa.Column("max_g_source", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("trips", "max_g_source")
    op.drop_column("trips", "max_g_force")
    op.drop_column("location_points", "peak_g")
