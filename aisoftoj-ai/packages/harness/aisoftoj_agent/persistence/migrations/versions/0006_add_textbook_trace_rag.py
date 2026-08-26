"""Add versioned textbook indexes and shared trace cache."""

import sqlalchemy as sa
from alembic import op

revision = "0006_textbook_rag"
down_revision = "0005_ai_access_control"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ai_textbook_indexes",
        sa.Column("id", sa.CHAR(36), primary_key=True),
        sa.Column("textbook_id", sa.BigInteger(), nullable=False),
        sa.Column("index_version", sa.String(64), nullable=False),
        sa.Column("source_hash", sa.CHAR(64), nullable=False),
        sa.Column("catalog_hash", sa.CHAR(64), nullable=False),
        sa.Column("retrieval_profile_version", sa.String(64), nullable=False),
        sa.Column("parser_name", sa.String(64), nullable=False),
        sa.Column("parser_version", sa.String(32), nullable=False),
        sa.Column("embedding_model", sa.String(128), nullable=False),
        sa.Column("reranker_model", sa.String(128), nullable=False),
        sa.Column("collection_name", sa.String(128), nullable=False),
        sa.Column("chunk_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("error_code", sa.String(64)),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("activated_at", sa.DateTime()),
        sa.Column("retired_at", sa.DateTime()),
        sa.Column(
            "active_marker",
            sa.Integer(),
            sa.Computed("CASE WHEN status = 'ACTIVE' THEN 1 ELSE NULL END", persisted=True),
        ),
        sa.UniqueConstraint("index_version", name="uq_ai_textbook_indexes_version"),
        sa.UniqueConstraint(
            "textbook_id", "active_marker", name="uq_ai_textbook_indexes_active"
        ),
    )
    op.create_index(
        "ix_ai_textbook_indexes_status",
        "ai_textbook_indexes",
        ["textbook_id", "status", "created_at"],
    )
    op.create_table(
        "ai_question_trace_cache",
        sa.Column("id", sa.CHAR(36), primary_key=True),
        sa.Column("question_id", sa.Integer(), nullable=False),
        sa.Column("question_content_hash", sa.CHAR(64), nullable=False),
        sa.Column("textbook_id", sa.BigInteger(), nullable=False),
        sa.Column("index_version", sa.String(64), nullable=False),
        sa.Column("retrieval_profile_version", sa.String(64), nullable=False),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("primary_knowledge_point_id", sa.BigInteger()),
        sa.Column("secondary_knowledge_point_ids_json", sa.JSON(), nullable=False),
        sa.Column("source_chunk_ids_json", sa.JSON(), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("result_json", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("expires_at", sa.DateTime()),
        sa.UniqueConstraint(
            "question_id",
            "question_content_hash",
            "textbook_id",
            "index_version",
            "retrieval_profile_version",
            name="uq_ai_question_trace_cache_key",
        ),
    )
    op.create_index(
        "ix_ai_question_trace_cache_lookup",
        "ai_question_trace_cache",
        ["question_id", "textbook_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_ai_question_trace_cache_lookup", table_name="ai_question_trace_cache")
    op.drop_table("ai_question_trace_cache")
    op.drop_index("ix_ai_textbook_indexes_status", table_name="ai_textbook_indexes")
    op.drop_table("ai_textbook_indexes")
