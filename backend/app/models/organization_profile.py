from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class OrganizationProfile(Base):
    __tablename__ = "organization_profiles"

    __table_args__ = (
        CheckConstraint(
            "id = 1",
            name="ck_organization_profiles_singleton",
        ),
    )

    id: Mapped[int] = mapped_column(
        primary_key=True,
        default=1,
    )

    name: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
    )

    short_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    unp: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )

    legal_address: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    email: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    phone: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    director_name: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    director_position: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    bank_name: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )

    bank_account: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    bank_code: Mapped[str | None] = mapped_column(
        String(100),
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