"""separate contract archive state

Revision ID: da5b270cb6f8
Revises: 46da33172999
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "da5b270cb6f8"
down_revision: str | None = "46da33172999"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Separate archive state from contract lifecycle status."""
    op.add_column(
        "contracts",
        sa.Column(
            "archived_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )

    op.create_index(
        op.f("ix_contracts_archived_at"),
        "contracts",
        ["archived_at"],
        unique=False,
    )

    op.execute(
        sa.text(
            """
            UPDATE contracts
            SET
                archived_at = COALESCE(
                    updated_at,
                    created_at,
                    CURRENT_TIMESTAMP
                ),
                status = 'draft'
            WHERE status = 'archived'
            """
        )
    )


def downgrade() -> None:
    """Restore archive state as the archived contract status."""
    op.execute(
        sa.text(
            """
            UPDATE contracts
            SET status = 'archived'
            WHERE archived_at IS NOT NULL
            """
        )
    )

    op.drop_index(
        op.f("ix_contracts_archived_at"),
        table_name="contracts",
    )

    op.drop_column(
        "contracts",
        "archived_at",
    )