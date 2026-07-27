"""limit contract analysis concurrency

Revision ID: f7c4a1e2b903
Revises: f2b7c4d9e1a6
Create Date: 2026-07-27
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "f7c4a1e2b903"
down_revision: str | None = "f2b7c4d9e1a6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        sa.text(
            """
            UPDATE contract_analysis_runs
            SET
                status = 'failed',
                error_code = 'analysis_interrupted',
                error_message = (
                    'Анализ был прерван при обновлении сервиса'
                ),
                completed_at = CURRENT_TIMESTAMP
            WHERE status = 'running'
            """
        )
    )
    op.drop_index(
        "uq_contract_analysis_runs_active_version",
        table_name="contract_analysis_runs",
    )
    op.create_index(
        "uq_contract_analysis_runs_single_running",
        "contract_analysis_runs",
        ["status"],
        unique=True,
        postgresql_where=sa.text(
            "status = 'running'"
        ),
        sqlite_where=sa.text(
            "status = 'running'"
        ),
    )


def downgrade() -> None:
    op.drop_index(
        "uq_contract_analysis_runs_single_running",
        table_name="contract_analysis_runs",
    )
    op.create_index(
        "uq_contract_analysis_runs_active_version",
        "contract_analysis_runs",
        ["document_version_id"],
        unique=True,
        postgresql_where=sa.text(
            "status = 'running'"
        ),
        sqlite_where=sa.text(
            "status = 'running'"
        ),
    )
