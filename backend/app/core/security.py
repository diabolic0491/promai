from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from enum import StrEnum
from uuid import uuid4

import jwt
from jwt import InvalidTokenError
from pwdlib import PasswordHash
from pwdlib.exceptions import UnknownHashError

from app.core.config import get_settings


settings = get_settings()
password_hash = PasswordHash.recommended()
JWT_ALGORITHM = "HS256"


class TokenType(StrEnum):
    ACCESS = "access"
    REFRESH = "refresh"


class InvalidAuthenticationTokenError(Exception):
    """JWT отсутствует, повреждён или неверного типа."""


@dataclass(frozen=True)
class TokenClaims:
    user_id: int
    token_type: TokenType
    jti: str
    expires_at: datetime


@dataclass(frozen=True)
class CreatedToken:
    value: str
    jti: str
    expires_at: datetime


def hash_password(password: str) -> str:
    return password_hash.hash(password)


def verify_password(
    password: str,
    stored_hash: str,
) -> bool:
    try:
        return password_hash.verify(
            password,
            stored_hash,
        )
    except (UnknownHashError, ValueError):
        return False


def create_token(
    *,
    user_id: int,
    role: str,
    token_type: TokenType,
    lifetime: timedelta,
) -> CreatedToken:
    issued_at = datetime.now(UTC)
    expires_at = issued_at + lifetime
    jti = uuid4().hex

    token = jwt.encode(
        {
            "sub": str(user_id),
            "role": role,
            "type": token_type.value,
            "jti": jti,
            "iat": issued_at,
            "exp": expires_at,
            "iss": settings.auth_issuer,
        },
        settings.auth_secret_key.get_secret_value(),
        algorithm=JWT_ALGORITHM,
    )

    return CreatedToken(
        value=token,
        jti=jti,
        expires_at=expires_at,
    )


def create_access_token(
    *,
    user_id: int,
    role: str,
) -> CreatedToken:
    return create_token(
        user_id=user_id,
        role=role,
        token_type=TokenType.ACCESS,
        lifetime=timedelta(
            minutes=(settings.auth_access_token_minutes),
        ),
    )


def create_refresh_token(
    *,
    user_id: int,
    role: str,
) -> CreatedToken:
    return create_token(
        user_id=user_id,
        role=role,
        token_type=TokenType.REFRESH,
        lifetime=timedelta(
            days=settings.auth_refresh_token_days,
        ),
    )


def decode_token(
    token: str,
    *,
    expected_type: TokenType,
) -> TokenClaims:
    try:
        payload = jwt.decode(
            token,
            settings.auth_secret_key.get_secret_value(),
            algorithms=[JWT_ALGORITHM],
            issuer=settings.auth_issuer,
            options={
                "require": [
                    "sub",
                    "type",
                    "jti",
                    "iat",
                    "exp",
                    "iss",
                ],
            },
        )

        token_type = TokenType(payload["type"])

        if token_type is not expected_type:
            raise InvalidAuthenticationTokenError

        user_id = int(payload["sub"])
        jti = payload["jti"]
        expires_at = datetime.fromtimestamp(
            payload["exp"],
            tz=UTC,
        )

        if user_id <= 0:
            raise ValueError

        if not isinstance(jti, str) or len(jti) != 32:
            raise ValueError
    except (
        InvalidTokenError,
        KeyError,
        TypeError,
        ValueError,
    ) as error:
        raise InvalidAuthenticationTokenError from error

    return TokenClaims(
        user_id=user_id,
        token_type=token_type,
        jti=jti,
        expires_at=expires_at,
    )
