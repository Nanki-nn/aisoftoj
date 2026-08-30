"""Store the local MinerU Markdown output for preview and reindex recovery."""

import sqlalchemy as sa
from alembic import op

revision = "0009_knowledge_parsed_markdown"
down_revision = "0008_knowledge_local_upload"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("ai_knowledge_documents", sa.Column("parsed_markdown_path", sa.String(2048)))


def downgrade() -> None:
    op.drop_column("ai_knowledge_documents", "parsed_markdown_path")
