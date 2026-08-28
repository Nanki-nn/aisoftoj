"""add AI access control configuration and rollout users

Revision ID: 0005
Revises: 0004
"""

import sqlalchemy as sa
from alembic import op

revision = "0005_ai_access_control"
down_revision = "0004_user_quota_overrides"
branch_labels = None
depends_on = None


def upgrade() -> None:
    access_config = op.create_table(
        "ai_access_config",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column(
            "globally_enabled",
            sa.Boolean(),
            server_default=sa.true(),
            nullable=False,
        ),
        sa.Column("updated_by_user_id", sa.Integer(), nullable=True),
        sa.Column("create_time", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("update_time", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.bulk_insert(access_config, [{"id": 1, "globally_enabled": True}])

    op.create_table(
        "ai_rollout_users",
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("created_by_user_id", sa.Integer(), nullable=False),
        sa.Column("updated_by_user_id", sa.Integer(), nullable=False),
        sa.Column("create_time", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("update_time", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("user_id"),
    )

    op.create_table(
        "ai_access_audit_log",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("action", sa.String(length=32), nullable=False),
        sa.Column("admin_user_id", sa.Integer(), nullable=False),
        sa.Column("target_user_id", sa.Integer(), nullable=True),
        sa.Column("old_value", sa.Boolean(), nullable=False),
        sa.Column("new_value", sa.Boolean(), nullable=False),
        sa.Column("create_time", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_ai_access_audit_created",
        "ai_access_audit_log",
        ["create_time", "id"],
    )


def downgrade() -> None:
    op.drop_index("ix_ai_access_audit_created", table_name="ai_access_audit_log")
    op.drop_table("ai_access_audit_log")
    op.drop_table("ai_rollout_users")
    op.drop_table("ai_access_config")
