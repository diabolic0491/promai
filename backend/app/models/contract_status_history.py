from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    DateTime,
    ForeignKey,
    String,
    func,
)
from sqlalchemy.orm import (
    Mapped,
    mapped_column,
    relationship,
)

from app.db.base import Base


if TYPE_CHECKING:
    from app.models.contract import Contract
    from app.models.user import User


class ContractStatusHistory(Base):
    __tablename__ = "contract_status_history"

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

    from_status: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )

    to_status: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    changed_by_user_id: Mapped[int | None] = (
        mapped_column(
            ForeignKey(
                "users.id",
                ondelete="SET NULL",
            ),
            nullable=True,
            index=True,
        )
    )

    changed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        index=True,
    )

    contract: Mapped["Contract"] = relationship(
        back_populates="status_history",
    )

    changed_by_user: Mapped[
        "User | None"
    ] = relationship(
        back_populates="contract_status_changes",
        foreign_keys=[changed_by_user_id],
    )
