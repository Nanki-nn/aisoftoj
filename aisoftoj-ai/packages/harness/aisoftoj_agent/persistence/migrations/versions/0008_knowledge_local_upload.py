"""Store local upload metadata for MinerU knowledge ingestion."""

import sqlalchemy as sa
from alembic import op

revision = "0008_knowledge_local_upload"
down_revision = "0007_mineru_knowledge_rag"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("ai_knowledge_documents", sa.Column("local_path", sa.String(2048)))
    op.add_column("ai_knowledge_documents", sa.Column("mineru_batch_id", sa.String(128)))


def downgrade() -> None:
    op.drop_column("ai_knowledge_documents", "mineru_batch_id")
    op.drop_column("ai_knowledge_documents", "local_path")
