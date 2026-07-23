"""add contract document versions

Revision ID: c4e8a1f0d2b7
Revises: b1f29d7c4e63
Create Date: 2026-07-23
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "c4e8a1f0d2b7"
down_revision: str | None = "b1f29d7c4e63"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "contract_document_versions",
        sa.Column(
            "id",
            sa.Integer(),
            autoincrement=True,
            nullable=False,
        ),
        sa.Column(
            "contract_id",
            sa.Integer(),
            nullable=False,
        ),
        sa.Column(
            "version_number",
            sa.Integer(),
            nullable=False,
        ),
        sa.Column(
            "template_id",
            sa.Integer(),
            nullable=False,
        ),
        sa.Column(
            "template_name",
            sa.String(length=255),
            nullable=False,
        ),
        sa.Column(
            "template_version",
            sa.Integer(),
            nullable=False,
        ),
        sa.Column(
            "source_data",
            postgresql.JSONB(
                astext_type=sa.Text()
            ),
            nullable=False,
        ),
        sa.Column(
            "file_name",
            sa.String(length=255),
            nullable=False,
        ),
        sa.Column(
            "storage_path",
            sa.String(length=1000),
            nullable=False,
        ),
        sa.Column(
            "file_sha256",
            sa.String(length=64),
            nullable=True,
        ),
        sa.Column(
            "file_size_bytes",
            sa.BigInteger(),
            nullable=True,
        ),
        sa.Column(
            "created_by_user_id",
            sa.Integer(),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "version_number > 0",
            name=(
                "ck_contract_document_versions_"
                "version_positive"
            ),
        ),
        sa.CheckConstraint(
            (
                "file_sha256 IS NULL "
                "OR length(file_sha256) = 64"
            ),
            name=(
                "ck_contract_document_versions_"
                "sha256_length"
            ),
        ),
        sa.CheckConstraint(
            (
                "file_size_bytes IS NULL "
                "OR file_size_bytes >= 0"
            ),
            name=(
                "ck_contract_document_versions_"
                "file_size_non_negative"
            ),
        ),
        sa.ForeignKeyConstraint(
            ["contract_id"],
            ["contracts.id"],
            name=(
                "fk_contract_document_versions_"
                "contract_id_contracts"
            ),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["template_id"],
            ["document_templates.id"],
            name=(
                "fk_contract_document_versions_"
                "template_id_document_templates"
            ),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["created_by_user_id"],
            ["users.id"],
            name=(
                "fk_contract_document_versions_"
                "created_by_user_id_users"
            ),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "contract_id",
            "version_number",
            name=(
                "uq_contract_document_versions_"
                "contract_version"
            ),
        ),
        sa.UniqueConstraint(
            "storage_path",
            name=(
                "uq_contract_document_versions_"
                "storage_path"
            ),
        ),
    )
    op.create_index(
        "ix_contract_document_versions_contract_id",
        "contract_document_versions",
        ["contract_id"],
        unique=False,
    )
    op.create_index(
        "ix_contract_document_versions_template_id",
        "contract_document_versions",
        ["template_id"],
        unique=False,
    )
    op.create_index(
        (
            "ix_contract_document_versions_"
            "created_by_user_id"
        ),
        "contract_document_versions",
        ["created_by_user_id"],
        unique=False,
    )
    op.create_index(
        "ix_contract_document_versions_created_at",
        "contract_document_versions",
        ["created_at"],
        unique=False,
    )

    op.execute(
        sa.text(
            """
            INSERT INTO contract_document_versions (
                contract_id,
                version_number,
                template_id,
                template_name,
                template_version,
                source_data,
                file_name,
                storage_path,
                file_sha256,
                file_size_bytes,
                created_by_user_id,
                created_at
            )
            SELECT
                contracts.id,
                1,
                templates.id,
                templates.name,
                templates.version,
                jsonb_build_object(
                    'legacy_backfill',
                    true,
                    'form_data',
                    contracts.form_data
                ),
                contracts.generated_file_name,
                contracts.generated_storage_path,
                NULL,
                NULL,
                NULL,
                contracts.updated_at
            FROM contracts
            JOIN document_templates AS templates
              ON templates.id = contracts.template_id
            WHERE contracts.generated_file_name IS NOT NULL
              AND contracts.generated_storage_path IS NOT NULL
            """
        )
    )


def downgrade() -> None:
    op.drop_index(
        "ix_contract_document_versions_created_at",
        table_name="contract_document_versions",
    )
    op.drop_index(
        (
            "ix_contract_document_versions_"
            "created_by_user_id"
        ),
        table_name="contract_document_versions",
    )
    op.drop_index(
        "ix_contract_document_versions_template_id",
        table_name="contract_document_versions",
    )
    op.drop_index(
        "ix_contract_document_versions_contract_id",
        table_name="contract_document_versions",
    )
    op.drop_table("contract_document_versions")
