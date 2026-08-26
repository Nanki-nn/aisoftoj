"""add daily token quota tables

Revision ID: 0003
Revises: 0002
"""

import sqlalchemy as sa
from alembic import context, op

revision = "0003_daily_token_quota"
down_revision = "0002_run_question"
branch_labels = None
depends_on = None


def run_id_type() -> sa.CHAR:
    """Match the existing ai_runs.id collation for MySQL foreign keys."""
    bind = op.get_bind()
    if context.is_offline_mode() or bind.dialect.name != "mysql":
        return sa.CHAR(36)
    collation = bind.execute(
        sa.text(
            """
            SELECT COLLATION_NAME
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'ai_runs'
              AND COLUMN_NAME = 'id'
            """
        )
    ).scalar_one_or_none()
    return sa.CHAR(36, collation=collation) if collation else sa.CHAR(36)


def upgrade() -> None:
    op.create_table(
        "ai_quota_config",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("daily_token_limit", sa.Integer(), nullable=False),
        sa.Column("updated_by_user_id", sa.Integer(), nullable=True),
        sa.Column("create_time", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("update_time", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    config_table = sa.table(
        "ai_quota_config",
        sa.column("id", sa.Integer),
        sa.column("daily_token_limit", sa.Integer),
    )
    op.bulk_insert(config_table, [{"id": 1, "daily_token_limit": 30000}])
    op.create_table(
        "ai_daily_token_usage",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("usage_date", sa.Date(), nullable=False),
        sa.Column("consumed_tokens", sa.Integer(), server_default="0", nullable=False),
        sa.Column("reserved_tokens", sa.Integer(), server_default="0", nullable=False),
        sa.Column("create_time", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("update_time", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "usage_date", name="uq_ai_daily_token_usage_user_date"),
    )
    op.create_table(
        "ai_token_reservations",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("run_id", run_id_type(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("usage_date", sa.Date(), nullable=False),
        sa.Column("model_call_sequence", sa.Integer(), nullable=False),
        sa.Column("reserved_tokens", sa.Integer(), nullable=False),
        sa.Column("prompt_tokens", sa.Integer(), nullable=True),
        sa.Column("completion_tokens", sa.Integer(), nullable=True),
        sa.Column("usage_source", sa.String(16), nullable=True),
        sa.Column("status", sa.String(24), nullable=False),
        sa.Column("create_time", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("update_time", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["run_id"], ["ai_runs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "run_id",
            "model_call_sequence",
            name="uq_ai_token_reservation_run_call",
        ),
    )
    op.create_index(
        "ix_ai_token_reservations_status",
        "ai_token_reservations",
        ["status", "create_time"],
    )


def downgrade() -> None:
    op.drop_index("ix_ai_token_reservations_status", table_name="ai_token_reservations")
    op.drop_table("ai_token_reservations")
    op.drop_table("ai_daily_token_usage")
    op.drop_table("ai_quota_config")
