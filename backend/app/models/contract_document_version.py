from datetime import datetime
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

    template_id: Mapped[int] = mapped_column(
        ForeignKey(
            "document_templates.id",
            ondelete="RESTRICT",
        ),
        nullable=False,
        index=True,
    )

    template_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    template_version: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
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

    template: Mapped["DocumentTemplate"] = (
        relationship()
    )

    created_by_user: Mapped["User | None"] = (
        relationship(
            back_populates="contract_document_versions",
        )
    )
