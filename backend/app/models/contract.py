from datetime import date, datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Any

from sqlalchemy import (
    Date,
    DateTime,
    ForeignKey,
    Numeric,
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
from app.models.contract_party_role import (
    ContractPartyRole,
    ContractStatus,
)

if TYPE_CHECKING:
    from app.models.contract_analysis import (
        ContractAnalysisRun,
    )
    from app.models.contract_document_version import (
        ContractDocumentVersion,
    )
    from app.models.contract_event import (
        ContractEvent,
    )
    from app.models.contract_status_history import (
        ContractStatusHistory,
    )
    from app.models.counterparty import Counterparty
    from app.models.document_template import (
        DocumentTemplate,
    )


class Contract(Base):
    __tablename__ = "contracts"

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

    template_id: Mapped[int | None] = mapped_column(
        ForeignKey(
            "document_templates.id",
            ondelete="RESTRICT",
        ),
        nullable=True,
        index=True,
    )

    number: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True,
    )

    title: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
    )

    contract_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
    )

    start_date: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
    )

    end_date: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
    )

    amount: Mapped[Decimal | None] = mapped_column(
        Numeric(18, 2),
        nullable=True,
    )

    currency: Mapped[str] = mapped_column(
        String(3),
        nullable=False,
        default="BYN",
        server_default="BYN",
    )

    status: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default=ContractStatus.DRAFT.value,
        server_default=ContractStatus.DRAFT.value,
    )

    archived_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        index=True,
    )

    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    owner_role: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default=ContractPartyRole.SUPPLIER.value,
        server_default=ContractPartyRole.SUPPLIER.value,
    )

    counterparty_role: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default=ContractPartyRole.BUYER.value,
        server_default=ContractPartyRole.BUYER.value,
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

    counterparty: Mapped["Counterparty"] = relationship(
        back_populates="contracts",
    )

    template: Mapped[
        "DocumentTemplate | None"
    ] = relationship()

    status_history: Mapped[
        list["ContractStatusHistory"]
    ] = relationship(
        back_populates="contract",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by=(
            "ContractStatusHistory.changed_at.desc()"
        ),
    )

    events: Mapped[
        list["ContractEvent"]
    ] = relationship(
        back_populates="contract",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by=(
            "ContractEvent.created_at.desc()"
        ),
    )

    document_versions: Mapped[
        list["ContractDocumentVersion"]
    ] = relationship(
        back_populates="contract",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by=(
            "ContractDocumentVersion."
            "version_number.desc()"
        ),
    )

    analysis_runs: Mapped[
        list["ContractAnalysisRun"]
    ] = relationship(
        back_populates="contract",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by=(
            "ContractAnalysisRun.started_at.desc()"
        ),
    )

    @property
    def is_archived(self) -> bool:
        return self.archived_at is not None

    @property
    def counterparty_name(self) -> str:
        return self.counterparty.name

    @property
    def template_name(self) -> str | None:
        if self.template is None:
            return None

        return self.template.name
