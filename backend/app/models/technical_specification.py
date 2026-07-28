from datetime import date, datetime
from enum import StrEnum
from typing import TYPE_CHECKING, Any

from sqlalchemy import (
    Date,
    DateTime,
    ForeignKey,
    String,
    Text,
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
    from app.models.counterparty import Counterparty
    from app.models.document_template import (
        DocumentTemplate,
    )


class TechnicalSpecificationStatus(StrEnum):
    DRAFT = "draft"
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    ISSUED = "issued"
    CANCELLED = "cancelled"


class TechnicalSpecification(Base):
    __tablename__ = "technical_specifications"

    id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True,
    )

    counterparty_id: Mapped[int] = mapped_column(
        ForeignKey(
            "counterparties.id",
            ondelete="RESTRICT",
        ),
        nullable=False,
        index=True,
    )

    contract_id: Mapped[int | None] = mapped_column(
        ForeignKey(
            "contracts.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )

    template_id: Mapped[int] = mapped_column(
        ForeignKey(
            "document_templates.id",
            ondelete="RESTRICT",
        ),
        nullable=False,
        index=True,
    )

    title: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
    )

    procurement_subject: Mapped[str] = (
        mapped_column(
            String(1000),
            nullable=False,
        )
    )

    procurement_procedure: Mapped[str] = (
        mapped_column(
            String(255),
            nullable=False,
            default="Открытый конкурс",
            server_default="Открытый конкурс",
        )
    )

    legal_basis: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    internal_regulation_document: Mapped[
        str
    ] = mapped_column(
        Text,
        nullable=False,
    )

    approval_date: Mapped[date | None] = (
        mapped_column(
            Date,
            nullable=True,
        )
    )

    work_start_date: Mapped[date | None] = (
        mapped_column(
            Date,
            nullable=True,
        )
    )

    work_end_date: Mapped[date | None] = (
        mapped_column(
            Date,
            nullable=True,
        )
    )

    status: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default=(
            TechnicalSpecificationStatus
            .DRAFT
            .value
        ),
        server_default=(
            TechnicalSpecificationStatus
            .DRAFT
            .value
        ),
        index=True,
    )

    form_data: Mapped[
        dict[str, Any]
    ] = mapped_column(
        JSONB,
        nullable=False,
        default=dict,
        server_default="{}",
    )

    generated_file_name: Mapped[
        str | None
    ] = mapped_column(
        String(255),
        nullable=True,
    )

    generated_storage_path: Mapped[
        str | None
    ] = mapped_column(
        String(1000),
        nullable=True,
    )

    archived_at: Mapped[datetime | None] = (
        mapped_column(
            DateTime(timezone=True),
            nullable=True,
            index=True,
        )
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    counterparty: Mapped[
        "Counterparty"
    ] = relationship()

    contract: Mapped[
        "Contract | None"
    ] = relationship()

    template: Mapped[
        "DocumentTemplate"
    ] = relationship()

    @property
    def is_archived(self) -> bool:
        return self.archived_at is not None

    @property
    def counterparty_name(self) -> str:
        return self.counterparty.name

    @property
    def contract_number(self) -> str | None:
        if self.contract is None:
            return None

        return self.contract.number

    @property
    def template_name(self) -> str:
        return self.template.name
