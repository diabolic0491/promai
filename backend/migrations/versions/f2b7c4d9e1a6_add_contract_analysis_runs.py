"""add contract analysis runs

Revision ID: f2b7c4d9e1a6
Revises: d8a3c2f6b1e4
Create Date: 2026-07-24
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "f2b7c4d9e1a6"
down_revision: str | None = "d8a3c2f6b1e4"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "contract_analysis_runs",
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
            "document_version_id",
            sa.Integer(),
            nullable=False,
        ),
        sa.Column(
            "version_number",
            sa.Integer(),
            nullable=False,
        ),
        sa.Column(
            "created_by_user_id",
            sa.Integer(),
            nullable=True,
        ),
        sa.Column(
            "status",
            sa.String(length=20),
            server_default="running",
            nullable=False,
        ),
        sa.Column(
            "executor",
            sa.String(length=100),
            nullable=False,
        ),
        sa.Column(
            "model",
            sa.String(length=255),
            nullable=False,
        ),
        sa.Column(
            "policy_id",
            sa.String(length=255),
            nullable=False,
        ),
        sa.Column(
            "policy_version",
            sa.String(length=100),
            nullable=False,
        ),
        sa.Column(
            "policy_sha256",
            sa.String(length=64),
            nullable=False,
        ),
        sa.Column(
            "source_file_sha256",
            sa.String(length=64),
            nullable=True,
        ),
        sa.Column(
            "extracted_text_sha256",
            sa.String(length=64),
            nullable=True,
        ),
        sa.Column(
            "result_id",
            sa.String(length=100),
            nullable=True,
        ),
        sa.Column(
            "result_status",
            sa.String(length=30),
            nullable=True,
        ),
        sa.Column(
            "requires_human_review",
            sa.Boolean(),
            nullable=True,
        ),
        sa.Column(
            "content_sha256",
            sa.String(length=64),
            nullable=True,
        ),
        sa.Column(
            "error_code",
            sa.String(length=100),
            nullable=True,
        ),
        sa.Column(
            "error_message",
            sa.Text(),
            nullable=True,
        ),
        sa.Column(
            "started_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "completed_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.CheckConstraint(
            "status IN ('running', 'completed', 'failed')",
            name="ck_contract_analysis_runs_status",
        ),
        sa.CheckConstraint(
            (
                "source_file_sha256 IS NULL "
                "OR length(source_file_sha256) = 64"
            ),
            name=(
                "ck_contract_analysis_runs_"
                "source_sha256_length"
            ),
        ),
        sa.CheckConstraint(
            (
                "extracted_text_sha256 IS NULL "
                "OR length(extracted_text_sha256) = 64"
            ),
            name=(
                "ck_contract_analysis_runs_"
                "text_sha256_length"
            ),
        ),
        sa.CheckConstraint(
            "length(policy_sha256) = 64",
            name=(
                "ck_contract_analysis_runs_"
                "policy_sha256_length"
            ),
        ),
        sa.CheckConstraint(
            (
                "content_sha256 IS NULL "
                "OR length(content_sha256) = 64"
            ),
            name=(
                "ck_contract_analysis_runs_"
                "content_sha256_length"
            ),
        ),
        sa.CheckConstraint(
            (
                "result_status IS NULL "
                "OR result_status = 'machine_draft'"
            ),
            name=(
                "ck_contract_analysis_runs_"
                "result_status"
            ),
        ),
        sa.CheckConstraint(
            (
                "(status = 'running' "
                "AND completed_at IS NULL "
                "AND result_id IS NULL "
                "AND result_status IS NULL "
                "AND requires_human_review IS NULL "
                "AND content_sha256 IS NULL "
                "AND error_code IS NULL "
                "AND error_message IS NULL) "
                "OR "
                "(status = 'completed' "
                "AND completed_at IS NOT NULL "
                "AND source_file_sha256 IS NOT NULL "
                "AND extracted_text_sha256 IS NOT NULL "
                "AND result_id IS NOT NULL "
                "AND result_status = 'machine_draft' "
                "AND requires_human_review IS TRUE "
                "AND content_sha256 IS NOT NULL "
                "AND error_code IS NULL "
                "AND error_message IS NULL) "
                "OR "
                "(status = 'failed' "
                "AND completed_at IS NOT NULL "
                "AND result_id IS NULL "
                "AND result_status IS NULL "
                "AND requires_human_review IS NULL "
                "AND content_sha256 IS NULL "
                "AND error_code IS NOT NULL "
                "AND error_message IS NOT NULL)"
            ),
            name=(
                "ck_contract_analysis_runs_"
                "status_payload"
            ),
        ),
        sa.ForeignKeyConstraint(
            ["contract_id"],
            ["contracts.id"],
            name=(
                "fk_contract_analysis_runs_"
                "contract_id_contracts"
            ),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["document_version_id"],
            ["contract_document_versions.id"],
            name=(
                "fk_contract_analysis_runs_"
                "document_version_id_versions"
            ),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["created_by_user_id"],
            ["users.id"],
            name=(
                "fk_contract_analysis_runs_"
                "created_by_user_id_users"
            ),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_contract_analysis_runs_contract_id",
        "contract_analysis_runs",
        ["contract_id"],
        unique=False,
    )
    op.create_index(
        "ix_contract_analysis_runs_document_version_id",
        "contract_analysis_runs",
        ["document_version_id"],
        unique=False,
    )
    op.create_index(
        "ix_contract_analysis_runs_created_by_user_id",
        "contract_analysis_runs",
        ["created_by_user_id"],
        unique=False,
    )
    op.create_index(
        "ix_contract_analysis_runs_status",
        "contract_analysis_runs",
        ["status"],
        unique=False,
    )
    op.create_index(
        "ix_contract_analysis_runs_result_id",
        "contract_analysis_runs",
        ["result_id"],
        unique=False,
    )
    op.create_index(
        "ix_contract_analysis_runs_started_at",
        "contract_analysis_runs",
        ["started_at"],
        unique=False,
    )
    op.create_index(
        "uq_contract_analysis_runs_active_version",
        "contract_analysis_runs",
        ["document_version_id"],
        unique=True,
        postgresql_where=sa.text(
            "status = 'running'"
        ),
    )

    op.create_table(
        "contract_analysis_findings",
        sa.Column(
            "id",
            sa.Integer(),
            autoincrement=True,
            nullable=False,
        ),
        sa.Column(
            "analysis_run_id",
            sa.Integer(),
            nullable=False,
        ),
        sa.Column(
            "finding_id",
            sa.String(length=100),
            nullable=False,
        ),
        sa.Column(
            "ordinal",
            sa.Integer(),
            nullable=False,
        ),
        sa.Column(
            "category",
            sa.String(length=100),
            nullable=False,
        ),
        sa.Column(
            "severity_level",
            sa.String(length=100),
            nullable=False,
        ),
        sa.Column(
            "title",
            sa.String(length=500),
            nullable=False,
        ),
        sa.Column(
            "description",
            sa.Text(),
            nullable=False,
        ),
        sa.Column(
            "content_sha256",
            sa.String(length=64),
            nullable=False,
        ),
        sa.CheckConstraint(
            "ordinal > 0",
            name=(
                "ck_contract_analysis_findings_"
                "ordinal_positive"
            ),
        ),
        sa.CheckConstraint(
            "length(content_sha256) = 64",
            name=(
                "ck_contract_analysis_findings_"
                "content_sha256_length"
            ),
        ),
        sa.ForeignKeyConstraint(
            ["analysis_run_id"],
            ["contract_analysis_runs.id"],
            name=(
                "fk_contract_analysis_findings_"
                "analysis_run_id_runs"
            ),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_contract_analysis_findings_analysis_run_id",
        "contract_analysis_findings",
        ["analysis_run_id"],
        unique=False,
    )
    op.create_index(
        "uq_contract_analysis_findings_run_ordinal",
        "contract_analysis_findings",
        ["analysis_run_id", "ordinal"],
        unique=True,
    )
    op.create_index(
        "uq_contract_analysis_findings_run_finding",
        "contract_analysis_findings",
        ["analysis_run_id", "finding_id"],
        unique=True,
    )

    op.create_table(
        "contract_analysis_evidence_references",
        sa.Column(
            "id",
            sa.Integer(),
            autoincrement=True,
            nullable=False,
        ),
        sa.Column(
            "finding_id",
            sa.Integer(),
            nullable=False,
        ),
        sa.Column(
            "ordinal",
            sa.Integer(),
            nullable=False,
        ),
        sa.Column(
            "block_id",
            sa.String(length=100),
            nullable=False,
        ),
        sa.Column(
            "block_ordinal",
            sa.Integer(),
            nullable=False,
        ),
        sa.Column(
            "start_character",
            sa.Integer(),
            nullable=False,
        ),
        sa.Column(
            "end_character",
            sa.Integer(),
            nullable=False,
        ),
        sa.Column(
            "quote",
            sa.Text(),
            nullable=False,
        ),
        sa.Column(
            "quote_sha256",
            sa.String(length=64),
            nullable=False,
        ),
        sa.CheckConstraint(
            "ordinal > 0",
            name=(
                "ck_contract_analysis_evidence_"
                "ordinal_positive"
            ),
        ),
        sa.CheckConstraint(
            (
                "block_ordinal > 0 "
                "AND start_character >= 0 "
                "AND end_character > start_character"
            ),
            name=(
                "ck_contract_analysis_evidence_"
                "range"
            ),
        ),
        sa.CheckConstraint(
            "length(quote_sha256) = 64",
            name=(
                "ck_contract_analysis_evidence_"
                "quote_sha256_length"
            ),
        ),
        sa.ForeignKeyConstraint(
            ["finding_id"],
            ["contract_analysis_findings.id"],
            name=(
                "fk_contract_analysis_evidence_"
                "finding_id_findings"
            ),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_contract_analysis_evidence_references_finding_id",
        "contract_analysis_evidence_references",
        ["finding_id"],
        unique=False,
    )
    op.create_index(
        "uq_contract_analysis_evidence_finding_ordinal",
        "contract_analysis_evidence_references",
        ["finding_id", "ordinal"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index(
        "uq_contract_analysis_evidence_finding_ordinal",
        table_name=(
            "contract_analysis_evidence_references"
        ),
    )
    op.drop_index(
        "ix_contract_analysis_evidence_references_finding_id",
        table_name=(
            "contract_analysis_evidence_references"
        ),
    )
    op.drop_table(
        "contract_analysis_evidence_references"
    )

    op.drop_index(
        "uq_contract_analysis_findings_run_finding",
        table_name="contract_analysis_findings",
    )
    op.drop_index(
        "uq_contract_analysis_findings_run_ordinal",
        table_name="contract_analysis_findings",
    )
    op.drop_index(
        "ix_contract_analysis_findings_analysis_run_id",
        table_name="contract_analysis_findings",
    )
    op.drop_table("contract_analysis_findings")

    op.drop_index(
        "uq_contract_analysis_runs_active_version",
        table_name="contract_analysis_runs",
    )
    op.drop_index(
        "ix_contract_analysis_runs_started_at",
        table_name="contract_analysis_runs",
    )
    op.drop_index(
        "ix_contract_analysis_runs_result_id",
        table_name="contract_analysis_runs",
    )
    op.drop_index(
        "ix_contract_analysis_runs_status",
        table_name="contract_analysis_runs",
    )
    op.drop_index(
        "ix_contract_analysis_runs_created_by_user_id",
        table_name="contract_analysis_runs",
    )
    op.drop_index(
        "ix_contract_analysis_runs_document_version_id",
        table_name="contract_analysis_runs",
    )
    op.drop_index(
        "ix_contract_analysis_runs_contract_id",
        table_name="contract_analysis_runs",
    )
    op.drop_table("contract_analysis_runs")
