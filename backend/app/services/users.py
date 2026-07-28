from datetime import UTC, datetime

from sqlalchemy import func, or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.refresh_session import RefreshSession
from app.models.user import User, UserRole
from app.schemas.user import (
    UserCreate,
    UserUpdate,
)
from app.services.pagination import (
    PageResult,
    paginate_scalars,
)


class UserNotFoundError(Exception):
    """Пользователь не найден."""


class UserAlreadyExistsError(Exception):
    """Имя пользователя уже занято."""


class EmptyUserUpdateError(Exception):
    """Не передано ни одного поля для изменения."""


class LastActiveAdminError(Exception):
    """Нельзя отключить последнего admin."""

    def __str__(self) -> str:
        return "Нельзя отключить или понизить последнего активного администратора"


class SelfDeactivationError(Exception):
    """Администратор не может отключить себя."""

    def __str__(self) -> str:
        return "Администратор не может отключить себя"


class SelfRoleChangeError(Exception):
    """Администратор не может изменить свою роль."""

    def __str__(self) -> str:
        return "Администратор не может изменить собственную роль"


def create_user(
    session: Session,
    payload: UserCreate,
) -> User:
    existing_user = session.scalar(
        select(User).where(User.username == payload.username)
    )

    if existing_user is not None:
        raise UserAlreadyExistsError

    user = User(
        username=payload.username,
        full_name=payload.full_name,
        password_hash=hash_password(payload.password),
        role=payload.role.value,
        is_active=payload.is_active,
    )

    session.add(user)

    try:
        session.commit()
    except IntegrityError as error:
        session.rollback()
        raise UserAlreadyExistsError from error

    session.refresh(user)

    return user


def list_users(
    session: Session,
    *,
    role: UserRole | None = None,
    is_active: bool | None = None,
    search: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> PageResult[User]:
    statement = select(User)

    if role is not None:
        statement = statement.where(User.role == role.value)

    if is_active is not None:
        statement = statement.where(User.is_active == is_active)

    if search:
        normalized_search = search.strip()
        statement = statement.where(
            or_(
                User.username.ilike(
                    f"%{normalized_search}%"
                ),
                User.full_name.ilike(
                    f"%{normalized_search}%"
                ),
            )
        )

    statement = statement.order_by(User.id)

    return paginate_scalars(
        session=session,
        statement=statement,
        limit=limit,
        offset=offset,
    )


def get_user_by_id(
    session: Session,
    user_id: int,
) -> User:
    user = session.get(User, user_id)

    if user is None:
        raise UserNotFoundError

    return user


def active_admin_count(
    session: Session,
) -> int:
    return (
        session.scalar(
            select(func.count(User.id)).where(
                User.role == UserRole.ADMIN.value,
                User.is_active.is_(True),
            )
        )
        or 0
    )


def update_user(
    session: Session,
    *,
    user_id: int,
    payload: UserUpdate,
    actor_user_id: int,
) -> User:
    user = get_user_by_id(
        session=session,
        user_id=user_id,
    )
    update_data = payload.model_dump(
        exclude_unset=True,
    )

    if not update_data:
        raise EmptyUserUpdateError

    requested_role = update_data.get("role")
    requested_active = update_data.get("is_active")
    password_changed = "password" in update_data

    if (
        user.id == actor_user_id
        and requested_role is not None
        and requested_role.value != user.role
    ):
        raise SelfRoleChangeError

    if user.id == actor_user_id and requested_active is False:
        raise SelfDeactivationError

    removes_active_admin = (
        user.role == UserRole.ADMIN.value
        and user.is_active
        and (
            (requested_role is not None and requested_role != UserRole.ADMIN)
            or requested_active is False
        )
    )

    if removes_active_admin and active_admin_count(session) <= 1:
        raise LastActiveAdminError

    if "password" in update_data:
        user.password_hash = hash_password(update_data.pop("password"))

    if requested_role is not None:
        update_data["role"] = requested_role.value

    for field_name, value in update_data.items():
        setattr(user, field_name, value)

    if requested_active is False or password_changed:
        session.execute(
            update(RefreshSession)
            .where(
                RefreshSession.user_id == user.id,
                RefreshSession.revoked_at.is_(None),
            )
            .values(
                revoked_at=datetime.now(UTC),
            )
        )

    session.commit()
    session.refresh(user)

    return user
