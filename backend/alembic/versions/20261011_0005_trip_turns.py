"""store left / right turn counts per trip

Revision ID: 20261011_0005
Revises: 20261011_0004
Create Date: 2026-10-11 00:00:01
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "20261011_0005"
down_revision = "20261011_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("trips", sa.Column("left_turns", sa.Integer(), nullable=True))
    op.add_column("trips", sa.Column("right_turns", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("trips", "right_turns")
    op.drop_column("trips", "left_turns")
