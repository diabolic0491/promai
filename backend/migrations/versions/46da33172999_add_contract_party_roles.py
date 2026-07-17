"""add contract party roles

Revision ID: 46da33172999
Revises: cb3db4533373
Create Date: 2026-07-17 11:08:12.334365
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "46da33172999"
down_revision: str | None = "cb3db4533373"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add the counterparty role to contracts."""
    op.add_column(
        "contracts",
        sa.Column(
            "counterparty_role",
            sa.String(length=50),
            server_default=sa.text("'buyer'"),
            nullable=False,
        ),
    )


def downgrade() -> None:
    """Remove the counterparty role from contracts."""
    op.drop_column(
        "contracts",
        "counterparty_role",
    )
