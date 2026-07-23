"""add contract document generation

Revision ID: 9c6c4b16a5ad
Revises: 5066d7fde410
Create Date: 2026-07-22

"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "9c6c4b16a5ad"
down_revision: str | None = "5066d7fde410"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add template, form data and generated file metadata."""

    op.add_column(
        "contracts",
        sa.Column(
            "template_id",
            sa.Integer(),
            nullable=True,
        ),
    )
    op.add_column(
        "contracts",
        sa.Column(
            "form_data",
            postgresql.JSONB(
                astext_type=sa.Text()
            ),
            server_default="{}",
            nullable=False,
        ),
    )
    op.add_column(
        "contracts",
        sa.Column(
            "generated_file_name",
            sa.String(length=255),
            nullable=True,
        ),
    )
    op.add_column(
        "contracts",
        sa.Column(
            "generated_storage_path",
            sa.String(length=1000),
            nullable=True,
        ),
    )
    op.create_index(
        op.f("ix_contracts_template_id"),
        "contracts",
        ["template_id"],
        unique=False,
    )
    op.create_foreign_key(
        "fk_contracts_template_id_document_templates",
        "contracts",
        "document_templates",
        ["template_id"],
        ["id"],
        ondelete="RESTRICT",
    )


def downgrade() -> None:
    """Remove contract document generation fields."""

    op.drop_constraint(
        "fk_contracts_template_id_document_templates",
        "contracts",
        type_="foreignkey",
    )
    op.drop_index(
        op.f("ix_contracts_template_id"),
        table_name="contracts",
    )
    op.drop_column(
        "contracts",
        "generated_storage_path",
    )
    op.drop_column(
        "contracts",
        "generated_file_name",
    )
    op.drop_column("contracts", "form_data")
    op.drop_column("contracts", "template_id")
