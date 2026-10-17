"""vehicle type, model year and horsepower for the Garage

Revision ID: 20261016_0006
Revises: 20261011_0005
Create Date: 2026-10-16 00:00:00
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "20261016_0006"
down_revision = "20261011_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("vehicles", sa.Column("vehicle_type", sa.Text(), nullable=False, server_default=sa.text("'car'")))
    op.add_column("vehicles", sa.Column("year", sa.Integer(), nullable=True))
    op.add_column("vehicles", sa.Column("horsepower", sa.Integer(), nullable=True))
    op.create_check_constraint("vehicles_vehicle_type_valid", "vehicles", "vehicle_type IN ('car', 'motorbike')")
    op.create_check_constraint("vehicles_year_range", "vehicles", "year IS NULL OR year BETWEEN 1900 AND 2100")
    op.create_check_constraint("vehicles_horsepower_positive", "vehicles", "horsepower IS NULL OR horsepower > 0")


def downgrade() -> None:
    op.drop_constraint("vehicles_horsepower_positive", "vehicles", type_="check")
    op.drop_constraint("vehicles_year_range", "vehicles", type_="check")
    op.drop_constraint("vehicles_vehicle_type_valid", "vehicles", type_="check")
    op.drop_column("vehicles", "horsepower")
    op.drop_column("vehicles", "year")
    op.drop_column("vehicles", "vehicle_type")
