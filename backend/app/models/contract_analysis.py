from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    func,
    text,
)
from sqlalchemy.orm import (
    Mapped,
    mapped_column,
    relationship,
)

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.contract import Contract
    from app.models.contract_document_version import (
        ContractDocumentVersion,
    )
    from app.models.user import User


class ContractAnalysisRunStatus(StrEnum):
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class ContractAnalysisResultStatus(StrEnum):
    MACHINE_DRAFT = "machine_draft"


class ContractAnalysisRun(Base):
    __tablename__ = "contract_analysis_runs"

    __table_args__ = (
        CheckConstraint(
            "status IN ('running', 'completed', 'failed')",
            name="ck_contract_analysis_runs_status",
        ),
        CheckConstraint(
            (
                "source_file_sha256 IS NULL "
                "OR length(source_file_sha256) = 64"
            ),
            name=(
                "ck_contract_analysis_runs_"
                "source_sha256_length"
            ),
        ),
        CheckConstraint(
            (
                "extracted_text_sha256 IS NULL "
                "OR length(extracted_text_sha256) = 64"
            ),
            name=(
                "ck_contract_analysis_runs_"
                "text_sha256_length"
            ),
        ),
        CheckConstraint(
            "length(policy_sha256) = 64",
            name=(
                "ck_contract_analysis_runs_"
                "policy_sha256_length"
            ),
        ),
        CheckConstraint(
            (
                "content_sha256 IS NULL "
                "OR length(content_sha256) = 64"
            ),
            name=(
                "ck_contract_analysis_runs_"
                "content_sha256_length"
            ),
        ),
        CheckConstraint(
            (
                "result_status IS NULL "
                "OR result_status = 'machine_draft'"
            ),
            name=(
                "ck_contract_analysis_runs_"
                "result_status"
            ),
        ),
        CheckConstraint(
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
        Index(
            "uq_contract_analysis_runs_active_version",
            "document_version_id",
            unique=True,
            postgresql_where=text(
                "status = 'running'"
            ),
            sqlite_where=text(
                "status = 'running'"
            ),
        ),
    )

    id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True,
    )
    contract_id: Mapped[int] = mapped_column(
        ForeignKey(
            "contracts.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )
    document_version_id: Mapped[int] = mapped_column(
        ForeignKey(
            "contract_document_versions.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )
    version_number: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    created_by_user_id: Mapped[int | None] = (
        mapped_column(
            ForeignKey(
                "users.id",
                ondelete="SET NULL",
            ),
            nullable=True,
            index=True,
        )
    )
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=ContractAnalysisRunStatus.RUNNING.value,
        server_default=(
            ContractAnalysisRunStatus.RUNNING.value
        ),
        index=True,
    )
    executor: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    model: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    policy_id: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    policy_version: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    policy_sha256: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
    )
    source_file_sha256: Mapped[str | None] = (
        mapped_column(
            String(64),
            nullable=True,
        )
    )
    extracted_text_sha256: Mapped[str | None] = (
        mapped_column(
            String(64),
            nullable=True,
        )
    )
    result_id: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        index=True,
    )
    result_status: Mapped[str | None] = (
        mapped_column(
            String(30),
            nullable=True,
        )
    )
    requires_human_review: Mapped[bool | None] = (
        mapped_column(
            Boolean,
            nullable=True,
        )
    )
    content_sha256: Mapped[str | None] = (
        mapped_column(
            String(64),
            nullable=True,
        )
    )
    error_code: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )
    error_message: Mapped[str | None] = (
        mapped_column(
            Text,
            nullable=True,
        )
    )
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        index=True,
    )
    completed_at: Mapped[datetime | None] = (
        mapped_column(
            DateTime(timezone=True),
            nullable=True,
        )
    )

    contract: Mapped["Contract"] = relationship(
        back_populates="analysis_runs",
    )
    document_version: Mapped[
        "ContractDocumentVersion"
    ] = relationship(
        back_populates="analysis_runs",
    )
    created_by_user: Mapped["User | None"] = (
        relationship(
            back_populates="contract_analysis_runs",
        )
    )
    findings: Mapped[
        list["ContractAnalysisFinding"]
    ] = relationship(
        back_populates="analysis_run",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by=(
            "ContractAnalysisFinding.ordinal"
        ),
    )


class ContractAnalysisFinding(Base):
    __tablename__ = "contract_analysis_findings"

    __table_args__ = (
        CheckConstraint(
            "ordinal > 0",
            name=(
                "ck_contract_analysis_findings_"
                "ordinal_positive"
            ),
        ),
        CheckConstraint(
            "length(content_sha256) = 64",
            name=(
                "ck_contract_analysis_findings_"
                "content_sha256_length"
            ),
        ),
        Index(
            "uq_contract_analysis_findings_run_ordinal",
            "analysis_run_id",
            "ordinal",
            unique=True,
        ),
        Index(
            "uq_contract_analysis_findings_run_finding",
            "analysis_run_id",
            "finding_id",
            unique=True,
        ),
    )

    id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True,
    )
    analysis_run_id: Mapped[int] = mapped_column(
        ForeignKey(
            "contract_analysis_runs.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )
    finding_id: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    ordinal: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    category: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    severity_level: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
    )
    description: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    content_sha256: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
    )

    analysis_run: Mapped[
        "ContractAnalysisRun"
    ] = relationship(
        back_populates="findings",
    )
    evidence_references: Mapped[
        list["ContractAnalysisEvidenceReference"]
    ] = relationship(
        back_populates="finding",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by=(
            "ContractAnalysisEvidenceReference.ordinal"
        ),
    )


class ContractAnalysisEvidenceReference(Base):
    __tablename__ = (
        "contract_analysis_evidence_references"
    )

    __table_args__ = (
        CheckConstraint(
            "ordinal > 0",
            name=(
                "ck_contract_analysis_evidence_"
                "ordinal_positive"
            ),
        ),
        CheckConstraint(
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
        CheckConstraint(
            "length(quote_sha256) = 64",
            name=(
                "ck_contract_analysis_evidence_"
                "quote_sha256_length"
            ),
        ),
        Index(
            "uq_contract_analysis_evidence_finding_ordinal",
            "finding_id",
            "ordinal",
            unique=True,
        ),
    )

    id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True,
    )
    finding_id: Mapped[int] = mapped_column(
        ForeignKey(
            "contract_analysis_findings.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )
    ordinal: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    block_id: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    block_ordinal: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    start_character: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    end_character: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    quote: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    quote_sha256: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
    )

    finding: Mapped[
        "ContractAnalysisFinding"
    ] = relationship(
        back_populates="evidence_references",
    )
