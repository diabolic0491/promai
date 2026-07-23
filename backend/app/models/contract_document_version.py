from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING, Any

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import (
    Mapped,
    mapped_column,
    relationship,
)

from app.db.base import Base


if TYPE_CHECKING:
    from app.models.contract import Contract
    from app.models.document_template import (
        DocumentTemplate,
    )
    from app.models.user import User


class ContractDocumentSource(StrEnum):
    GENERATED = "generated"
    UPLOADED = "uploaded"


class ContractDocumentVersion(Base):
    __tablename__ = "contract_document_versions"

    __table_args__ = (
        CheckConstraint(
            "version_number > 0",
            name=(
                "ck_contract_document_versions_"
                "version_positive"
            ),
        ),
        CheckConstraint(
            (
                "file_sha256 IS NULL "
                "OR length(file_sha256) = 64"
            ),
            name=(
                "ck_contract_document_versions_"
                "sha256_length"
            ),
        ),
        CheckConstraint(
            (
                "file_size_bytes IS NULL "
                "OR file_size_bytes >= 0"
            ),
            name=(
                "ck_contract_document_versions_"
                "file_size_non_negative"
            ),
        ),
        CheckConstraint(
            "source IN ('generated', 'uploaded')",
            name=(
                "ck_contract_document_versions_"
                "source"
            ),
        ),
        CheckConstraint(
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
            name=(
                "ck_contract_document_versions_"
                "source_template"
            ),
        ),
        UniqueConstraint(
            "contract_id",
            "version_number",
            name=(
                "uq_contract_document_versions_"
                "contract_version"
            ),
        ),
        UniqueConstraint(
            "storage_path",
            name=(
                "uq_contract_document_versions_"
                "storage_path"
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

    version_number: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    source: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=ContractDocumentSource.GENERATED.value,
        server_default=(
            ContractDocumentSource.GENERATED.value
        ),
    )

    template_id: Mapped[int | None] = mapped_column(
        ForeignKey(
            "document_templates.id",
            ondelete="RESTRICT",
        ),
        nullable=True,
        index=True,
    )

    template_name: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    template_version: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )

    source_data: Mapped[
        dict[str, Any]
    ] = mapped_column(
        JSONB,
        nullable=False,
    )

    file_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    storage_path: Mapped[str] = mapped_column(
        String(1000),
        nullable=False,
    )

    file_sha256: Mapped[str | None] = mapped_column(
        String(64),
        nullable=True,
    )

    file_size_bytes: Mapped[
        int | None
    ] = mapped_column(
        BigInteger,
        nullable=True,
    )

    created_by_user_id: Mapped[
        int | None
    ] = mapped_column(
        ForeignKey(
            "users.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        index=True,
    )

    contract: Mapped["Contract"] = relationship(
        back_populates="document_versions",
    )

    template: Mapped["DocumentTemplate | None"] = (
        relationship()
    )

    created_by_user: Mapped["User | None"] = (
        relationship(
            back_populates="contract_document_versions",
        )
    )
