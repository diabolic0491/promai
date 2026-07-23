from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import (
    InvalidAuthenticationTokenError,
    TokenType,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    settings,
    verify_password,
)
from app.models.refresh_session import RefreshSession
from app.models.user import User
from app.schemas.auth import TokenPair
from app.schemas.user import normalize_username


class InvalidCredentialsError(Exception):
    """Неверное имя пользователя или пароль."""


class InactiveUserError(Exception):
    """Пользователь отключён."""


class InvalidRefreshTokenError(Exception):
    """Refresh-токен недействителен или отозван."""


DUMMY_PASSWORD_HASH = hash_password("promai-nonexistent-user-password")


def normalize_database_datetime(
    value: datetime,
) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)

    return value


def build_token_pair(
    session: Session,
    user: User,
) -> TokenPair:
    access_token = create_access_token(
        user_id=user.id,
        role=user.role,
    )
    refresh_token = create_refresh_token(
        user_id=user.id,
        role=user.role,
    )

    session.add(
        RefreshSession(
            user_id=user.id,
            jti=refresh_token.jti,
            expires_at=refresh_token.expires_at,
        )
    )

    return TokenPair(
        access_token=access_token.value,
        refresh_token=refresh_token.value,
        access_expires_in=(settings.auth_access_token_minutes * 60),
    )


def authenticate_user(
    session: Session,
    *,
    username: str,
    password: str,
) -> TokenPair:
    try:
        normalized_username = normalize_username(username)
    except ValueError as error:
        raise InvalidCredentialsError from error

    user = session.scalar(select(User).where(User.username == normalized_username))

    stored_hash = user.password_hash if user is not None else DUMMY_PASSWORD_HASH

    if not verify_password(password, stored_hash):
        raise InvalidCredentialsError

    if user is None:
        raise InvalidCredentialsError

    if not user.is_active:
        raise InactiveUserError

    token_pair = build_token_pair(
        session=session,
        user=user,
    )
    user.last_login_at = datetime.now(UTC)
    session.commit()

    return token_pair


def rotate_refresh_token(
    session: Session,
    *,
    raw_refresh_token: str,
) -> TokenPair:
    try:
        claims = decode_token(
            raw_refresh_token,
            expected_type=TokenType.REFRESH,
        )
    except InvalidAuthenticationTokenError as error:
        raise InvalidRefreshTokenError from error

    refresh_session = session.scalar(
        select(RefreshSession).where(RefreshSession.jti == claims.jti).with_for_update()
    )

    if (
        refresh_session is None
        or refresh_session.revoked_at is not None
        or normalize_database_datetime(refresh_session.expires_at) <= datetime.now(UTC)
        or refresh_session.user_id != claims.user_id
    ):
        raise InvalidRefreshTokenError

    user = session.get(
        User,
        claims.user_id,
    )

    if user is None:
        raise InvalidRefreshTokenError

    if not user.is_active:
        raise InactiveUserError

    refresh_session.revoked_at = datetime.now(UTC)
    token_pair = build_token_pair(
        session=session,
        user=user,
    )
    new_claims = decode_token(
        token_pair.refresh_token,
        expected_type=TokenType.REFRESH,
    )
    refresh_session.replaced_by_jti = new_claims.jti
    session.commit()

    return token_pair


def revoke_refresh_token(
    session: Session,
    *,
    raw_refresh_token: str,
    actor_user_id: int,
) -> None:
    try:
        claims = decode_token(
            raw_refresh_token,
            expected_type=TokenType.REFRESH,
        )
    except InvalidAuthenticationTokenError:
        return

    if claims.user_id != actor_user_id:
        return

    refresh_session = session.scalar(
        select(RefreshSession).where(
            RefreshSession.jti == claims.jti,
            RefreshSession.user_id == actor_user_id,
        )
    )

    if refresh_session is not None and refresh_session.revoked_at is None:
        refresh_session.revoked_at = datetime.now(UTC)
        session.commit()
