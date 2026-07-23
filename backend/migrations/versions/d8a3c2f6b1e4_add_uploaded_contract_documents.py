"""add uploaded contract documents

Revision ID: d8a3c2f6b1e4
Revises: c4e8a1f0d2b7
Create Date: 2026-07-23
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "d8a3c2f6b1e4"
down_revision: str | None = "c4e8a1f0d2b7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "contract_document_versions",
        sa.Column(
            "source",
            sa.String(length=20),
            server_default="generated",
            nullable=False,
        ),
    )
    op.alter_column(
        "contract_document_versions",
        "template_id",
        existing_type=sa.Integer(),
        nullable=True,
    )
    op.alter_column(
        "contract_document_versions",
        "template_name",
        existing_type=sa.String(length=255),
        nullable=True,
    )
    op.alter_column(
        "contract_document_versions",
        "template_version",
        existing_type=sa.Integer(),
        nullable=True,
    )
    op.create_check_constraint(
        "ck_contract_document_versions_source",
        "contract_document_versions",
        "source IN ('generated', 'uploaded')",
    )
    op.create_check_constraint(
        (
            "ck_contract_document_versions_"
            "source_template"
        ),
        "contract_document_versions",
        (
            "(source = 'generated' "
            "AND template_id IS NOT NULL "
            "AND template_name IS NOT NULL "
            "AND template_version IS NOT NULL) "
            "OR "
            "(source = 'uploaded' "
            "AND template_id IS NULL "
            "AND template_name IS NULL "
            "AND template_version IS NULL)"
        ),
    )


def downgrade() -> None:
    op.execute(
        sa.text(
            """
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1
                    FROM contract_document_versions
                    WHERE source = 'uploaded'
                ) THEN
                    RAISE EXCEPTION 'Cannot downgrade while uploaded contract document versions exist';
                END IF;
            END
            $$;
            """
        )
    )
    op.drop_constraint(
        (
            "ck_contract_document_versions_"
            "source_template"
        ),
        "contract_document_versions",
        type_="check",
    )
    op.drop_constraint(
        "ck_contract_document_versions_source",
        "contract_document_versions",
        type_="check",
    )
    op.alter_column(
        "contract_document_versions",
        "template_version",
        existing_type=sa.Integer(),
        nullable=False,
    )
    op.alter_column(
        "contract_document_versions",
        "template_name",
        existing_type=sa.String(length=255),
        nullable=False,
    )
    op.alter_column(
        "contract_document_versions",
        "template_id",
        existing_type=sa.Integer(),
        nullable=False,
    )
    op.drop_column(
        "contract_document_versions",
        "source",
    )
