from datetime import date, datetime
from decimal import Decimal
from typing import TYPE_CHECKING


from sqlalchemy import (
    Date,
    DateTime,
    ForeignKey,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.orm import (
    Mapped,
    mapped_column,
    relationship,
)

from app.db.base import Base
from app.models.contract_party_role import (
    ContractPartyRole,
    ContractStatus
)


if TYPE_CHECKING:
    from app.models.counterparty import Counterparty


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