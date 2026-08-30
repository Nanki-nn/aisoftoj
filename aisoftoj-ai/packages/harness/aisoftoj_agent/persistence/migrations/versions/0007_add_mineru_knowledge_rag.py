"""Add MinerU-backed knowledge document indexes."""

import sqlalchemy as sa
from alembic import op

revision = "0007_mineru_knowledge_rag"
down_revision = "0006_textbook_rag"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ai_knowledge_documents",
        sa.Column("id", sa.CHAR(36), primary_key=True),
        sa.Column("title", sa.String(256), nullable=False),
        sa.Column("source_url", sa.String(2048), nullable=False),
        sa.Column("is_ocr", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("mineru_task_id", sa.String(128)),
        sa.Column("markdown_url", sa.String(2048)),
        sa.Column("source_hash", sa.CHAR(64)),
        sa.Column("index_version", sa.String(64), nullable=False),
        sa.Column("embedding_model", sa.String(128), nullable=False),
        sa.Column("collection_name", sa.String(128), nullable=False),
        sa.Column("chunk_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("error_code", sa.String(64)),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
        sa.Column("activated_at", sa.DateTime()),
        sa.UniqueConstraint("index_version", name="uq_ai_knowledge_documents_index_version"),
    )
    op.create_index(
        "ix_ai_knowledge_documents_status",
        "ai_knowledge_documents",
        ["status", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_ai_knowledge_documents_status", table_name="ai_knowledge_documents")
    op.drop_table("ai_knowledge_documents")
