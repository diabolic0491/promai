"""add users and rbac

Revision ID: b1f29d7c4e63
Revises: 9c6c4b16a5ad
Create Date: 2026-07-23
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "b1f29d7c4e63"
down_revision: str | None = "9c6c4b16a5ad"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column(
            "id",
            sa.Integer(),
            autoincrement=True,
            nullable=False,
        ),
        sa.Column(
            "username",
            sa.String(length=100),
            nullable=False,
        ),
        sa.Column(
            "full_name",
            sa.String(length=255),
            nullable=True,
        ),
        sa.Column(
            "password_hash",
            sa.String(length=255),
            nullable=False,
        ),
        sa.Column(
            "role",
            sa.String(length=20),
            server_default="manager",
            nullable=False,
        ),
        sa.Column(
            "is_active",
            sa.Boolean(),
            server_default=sa.text("true"),
            nullable=False,
        ),
        sa.Column(
            "last_login_at",
            sa.DateTime(timezone=True),
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
            "role IN ('admin', 'manager')",
            name="ck_users_role",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_users_username",
        "users",
        ["username"],
        unique=True,
    )
    op.create_index(
        "ix_users_role",
        "users",
        ["role"],
        unique=False,
    )
    op.create_index(
        "ix_users_is_active",
        "users",
        ["is_active"],
        unique=False,
    )

    op.create_table(
        "refresh_sessions",
        sa.Column(
            "id",
            sa.Integer(),
            autoincrement=True,
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.Integer(),
            nullable=False,
        ),
        sa.Column(
            "jti",
            sa.String(length=32),
            nullable=False,
        ),
        sa.Column(
            "expires_at",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
        sa.Column(
            "revoked_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.Column(
            "replaced_by_jti",
            sa.String(length=32),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=("fk_refresh_sessions_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_refresh_sessions_user_id",
        "refresh_sessions",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        "ix_refresh_sessions_jti",
        "refresh_sessions",
        ["jti"],
        unique=True,
    )
    op.create_index(
        "ix_refresh_sessions_expires_at",
        "refresh_sessions",
        ["expires_at"],
        unique=False,
    )
    op.create_index(
        "ix_refresh_sessions_revoked_at",
        "refresh_sessions",
        ["revoked_at"],
        unique=False,
    )

    op.add_column(
        "contract_events",
        sa.Column(
            "actor_user_id",
            sa.Integer(),
            nullable=True,
        ),
    )
    op.create_foreign_key(
        "fk_contract_events_actor_user_id_users",
        "contract_events",
        "users",
        ["actor_user_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_contract_events_actor_user_id",
        "contract_events",
        ["actor_user_id"],
        unique=False,
    )

    op.add_column(
        "contract_status_history",
        sa.Column(
            "changed_by_user_id",
            sa.Integer(),
            nullable=True,
        ),
    )
    op.create_foreign_key(
        ("fk_contract_status_history_changed_by_user_id_users"),
        "contract_status_history",
        "users",
        ["changed_by_user_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        ("ix_contract_status_history_changed_by_user_id"),
        "contract_status_history",
        ["changed_by_user_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        ("ix_contract_status_history_changed_by_user_id"),
        table_name="contract_status_history",
    )
    op.drop_constraint(
        ("fk_contract_status_history_changed_by_user_id_users"),
        "contract_status_history",
        type_="foreignkey",
    )
    op.drop_column(
        "contract_status_history",
        "changed_by_user_id",
    )

    op.drop_index(
        "ix_contract_events_actor_user_id",
        table_name="contract_events",
    )
    op.drop_constraint(
        "fk_contract_events_actor_user_id_users",
        "contract_events",
        type_="foreignkey",
    )
    op.drop_column(
        "contract_events",
        "actor_user_id",
    )

    op.drop_index(
        "ix_refresh_sessions_revoked_at",
        table_name="refresh_sessions",
    )
    op.drop_index(
        "ix_refresh_sessions_expires_at",
        table_name="refresh_sessions",
    )
    op.drop_index(
        "ix_refresh_sessions_jti",
        table_name="refresh_sessions",
    )
    op.drop_index(
        "ix_refresh_sessions_user_id",
        table_name="refresh_sessions",
    )
    op.drop_table("refresh_sessions")

    op.drop_index(
        "ix_users_is_active",
        table_name="users",
    )
    op.drop_index(
        "ix_users_role",
        table_name="users",
    )
    op.drop_index(
        "ix_users_username",
        table_name="users",
    )
    op.drop_table("users")
