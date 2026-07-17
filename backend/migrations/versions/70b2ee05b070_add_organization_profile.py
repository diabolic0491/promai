"""add organization profile

Revision ID: 70b2ee05b070
Revises: 86afd2ca2f34
Create Date: 2026-07-17

"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


# Идентификаторы Alembic.
revision: str = "70b2ee05b070"

# Замените PREVIOUS_REVISION_ID на ID предыдущей миграции.
down_revision: str | None = "86afd2ca2f34"

branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Создать профиль предприятия и начальную запись."""

    op.create_table(
        "organization_profiles",
        sa.Column(
            "id",
            sa.Integer(),
            nullable=False,
        ),
        sa.Column(
            "name",
            sa.String(length=500),
            nullable=False,
        ),
        sa.Column(
            "short_name",
            sa.String(length=255),
            nullable=False,
        ),
        sa.Column(
            "unp",
            sa.String(length=50),
            nullable=True,
        ),
        sa.Column(
            "legal_address",
            sa.Text(),
            nullable=True,
        ),
        sa.Column(
            "email",
            sa.String(length=255),
            nullable=True,
        ),
        sa.Column(
            "phone",
            sa.String(length=100),
            nullable=True,
        ),
        sa.Column(
            "director_name",
            sa.String(length=255),
            nullable=True,
        ),
        sa.Column(
            "bank_name",
            sa.String(length=500),
            nullable=True,
        ),
        sa.Column(
            "bank_account",
            sa.String(length=100),
            nullable=True,
        ),
        sa.Column(
            "bank_code",
            sa.String(length=100),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "id = 1",
            name="ck_organization_profiles_singleton",
        ),
        sa.PrimaryKeyConstraint(
            "id",
            name=op.f(
                "pk_organization_profiles"
            ),
        ),
    )

    op.execute(
        sa.text(
            """
            INSERT INTO organization_profiles (
                id,
                name,
                short_name
            )
            VALUES (
                1,
                'ООО «Промас Инжиниринг»',
                'ООО «Промас Инжиниринг»'
            )
            """
        )
    )


def downgrade() -> None:
    """Удалить профиль предприятия."""

    op.drop_table("organization_profiles")