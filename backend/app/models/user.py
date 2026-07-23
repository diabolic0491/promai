from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
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
    from app.models.contract_document_version import (
        ContractDocumentVersion,
    )
    from app.models.contract_event import ContractEvent
    from app.models.contract_status_history import (
        ContractStatusHistory,
    )
    from app.models.refresh_session import RefreshSession


class UserRole(StrEnum):
    ADMIN = "admin"
    MANAGER = "manager"


class User(Base):
    __tablename__ = "users"

    __table_args__ = (
        CheckConstraint(
            "role IN ('admin', 'manager')",
            name="ck_users_role",
        ),
    )

    id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True,
    )

    username: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        unique=True,
        index=True,
    )

    full_name: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    password_hash: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    role: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=UserRole.MANAGER.value,
        server_default=UserRole.MANAGER.value,
        index=True,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default="true",
        index=True,
    )

    last_login_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
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

    refresh_sessions: Mapped[list["RefreshSession"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    contract_events: Mapped[list["ContractEvent"]] = relationship(
        back_populates="actor_user",
        foreign_keys="ContractEvent.actor_user_id",
    )

    contract_document_versions: Mapped[
        list["ContractDocumentVersion"]
    ] = relationship(
        back_populates="created_by_user",
        foreign_keys=(
            "ContractDocumentVersion.created_by_user_id"
        ),
    )

    contract_status_changes: Mapped[list["ContractStatusHistory"]] = relationship(
        back_populates="changed_by_user",
        foreign_keys=("ContractStatusHistory.changed_by_user_id"),
    )
