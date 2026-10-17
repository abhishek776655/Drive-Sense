"""onboarding: optional email, driving frequency, weekly goal, terms acceptance

Revision ID: 20261017_0009
Revises: 20261017_0008
Create Date: 2026-10-17 00:00:02
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "20261017_0009"
down_revision = "20261017_0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Sign-up is handle + password now; email is an optional recovery address.
    op.alter_column("users", "email", existing_type=sa.dialects.postgresql.CITEXT(), nullable=True)
    op.add_column("users", sa.Column("driving_frequency", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("weekly_goal", sa.SmallInteger(), nullable=True))
    op.add_column("users", sa.Column("terms_accepted_at", sa.DateTime(timezone=True), nullable=True))
    op.create_check_constraint(
        "users_driving_frequency_valid",
        "users",
        "driving_frequency IS NULL OR driving_frequency IN ('daily', 'most', 'weekends', 'rarely')",
    )
    op.create_check_constraint("users_weekly_goal_range", "users", "weekly_goal IS NULL OR weekly_goal BETWEEN 1 AND 14")
    # Accounts that existed before onboarding have already been using the app: don't send them
    # through it.
    op.execute("UPDATE users SET terms_accepted_at = created_at WHERE terms_accepted_at IS NULL")


def downgrade() -> None:
    op.drop_constraint("users_weekly_goal_range", "users", type_="check")
    op.drop_constraint("users_driving_frequency_valid", "users", type_="check")
    op.drop_column("users", "terms_accepted_at")
    op.drop_column("users", "weekly_goal")
    op.drop_column("users", "driving_frequency")
    op.execute("DELETE FROM users WHERE email IS NULL")
    op.alter_column("users", "email", existing_type=sa.dialects.postgresql.CITEXT(), nullable=False)
