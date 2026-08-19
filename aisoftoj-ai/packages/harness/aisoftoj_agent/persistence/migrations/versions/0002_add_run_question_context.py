"""Add the current question snapshot to AI runs."""

import sqlalchemy as sa
from alembic import op

revision = "0002_run_question"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("ai_runs", sa.Column("question_id", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("ai_runs", "question_id")
