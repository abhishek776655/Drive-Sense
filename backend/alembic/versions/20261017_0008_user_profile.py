"""user @handle and profile photo

Revision ID: 20261017_0008
Revises: 20261017_0007
Create Date: 2026-10-17 00:00:01
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "20261017_0008"
down_revision = "20261017_0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("handle", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("avatar", sa.LargeBinary(), nullable=True))
    op.add_column("users", sa.Column("avatar_updated_at", sa.DateTime(timezone=True), nullable=True))
    op.create_unique_constraint("users_handle_key", "users", ["handle"])
    op.create_check_constraint("users_handle_format", "users", "handle IS NULL OR handle ~ '^[a-z0-9_]{3,20}$'")


def downgrade() -> None:
    op.drop_constraint("users_handle_format", "users", type_="check")
    op.drop_constraint("users_handle_key", "users", type_="unique")
    op.drop_column("users", "avatar_updated_at")
    op.drop_column("users", "avatar")
    op.drop_column("users", "handle")
