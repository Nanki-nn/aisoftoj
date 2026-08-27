"""add per-user token quota overrides

Revision ID: 0004
Revises: 0003
"""

import sqlalchemy as sa
from alembic import op

revision = "0004_user_quota_overrides"
down_revision = "0003_daily_token_quota"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ai_user_quota_overrides",
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("daily_token_limit", sa.Integer(), nullable=False),
        sa.Column("updated_by_user_id", sa.Integer(), nullable=False),
        sa.Column("create_time", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("update_time", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("user_id"),
    )


def downgrade() -> None:
    op.drop_table("ai_user_quota_overrides")
