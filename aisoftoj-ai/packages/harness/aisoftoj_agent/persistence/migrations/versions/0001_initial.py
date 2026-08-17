"""Create AI runtime tables."""

import sqlalchemy as sa
from alembic import op

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ai_threads",
        sa.Column("id", sa.CHAR(36), primary_key=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(120)),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("create_time", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("update_time", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("delete_time", sa.DateTime()),
    )
    op.create_index(
        "ix_ai_threads_owner_list",
        "ai_threads",
        ["user_id", "is_deleted", "update_time", "id"],
    )
    op.create_table(
        "ai_messages",
        sa.Column("id", sa.CHAR(36), primary_key=True),
        sa.Column("thread_id", sa.CHAR(36), nullable=False),
        sa.Column("run_id", sa.CHAR(36)),
        sa.Column("role", sa.String(16), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column("create_time", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["thread_id"], ["ai_threads.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("thread_id", "sequence", name="uq_ai_messages_thread_sequence"),
    )
    op.create_table(
        "ai_runs",
        sa.Column("id", sa.CHAR(36), primary_key=True),
        sa.Column("thread_id", sa.CHAR(36), nullable=False),
        sa.Column("idempotency_key", sa.String(128), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("input_message_id", sa.CHAR(36), nullable=False),
        sa.Column("output_message_id", sa.CHAR(36)),
        sa.Column("error_code", sa.String(64)),
        sa.Column("model_name", sa.String(128), nullable=False),
        sa.Column("prompt_tokens", sa.Integer()),
        sa.Column("completion_tokens", sa.Integer()),
        sa.Column("started_at", sa.DateTime()),
        sa.Column("finished_at", sa.DateTime()),
        sa.Column("create_time", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("update_time", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column(
            "active_marker",
            sa.Integer(),
            sa.Computed(
                "CASE WHEN status IN ('queued','running') THEN 1 ELSE NULL END",
                persisted=True,
            ),
        ),
        sa.ForeignKeyConstraint(["thread_id"], ["ai_threads.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["input_message_id"], ["ai_messages.id"]),
        sa.ForeignKeyConstraint(["output_message_id"], ["ai_messages.id"]),
        sa.UniqueConstraint("thread_id", "idempotency_key", name="uq_ai_runs_idempotency"),
        sa.UniqueConstraint("thread_id", "active_marker", name="uq_ai_runs_active"),
    )
    op.create_foreign_key("fk_ai_messages_run", "ai_messages", "ai_runs", ["run_id"], ["id"])
    op.create_index("ix_ai_runs_thread_created", "ai_runs", ["thread_id", "create_time", "id"])
    op.create_table(
        "ai_run_events",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("run_id", sa.CHAR(36), nullable=False),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column("event_type", sa.String(32), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("create_time", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["run_id"], ["ai_runs.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("run_id", "sequence", name="uq_ai_run_events_sequence"),
    )
    op.create_table(
        "ai_thread_summaries",
        sa.Column("thread_id", sa.CHAR(36), primary_key=True),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("summarized_through_sequence", sa.Integer(), nullable=False),
        sa.Column("create_time", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("update_time", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["thread_id"], ["ai_threads.id"], ondelete="CASCADE"),
    )


def downgrade() -> None:
    op.drop_table("ai_thread_summaries")
    op.drop_table("ai_run_events")
    op.drop_index("ix_ai_runs_thread_created", table_name="ai_runs")
    op.drop_constraint("fk_ai_messages_run", "ai_messages", type_="foreignkey")
    op.drop_table("ai_runs")
    op.drop_table("ai_messages")
    op.drop_index("ix_ai_threads_owner_list", table_name="ai_threads")
    op.drop_table("ai_threads")
