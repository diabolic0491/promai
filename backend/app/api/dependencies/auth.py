from typing import Annotated

from fastapi import (
    Depends,
    HTTPException,
    status,
)
from fastapi.security import (
    HTTPAuthorizationCredentials,
    HTTPBearer,
)
from sqlalchemy.orm import Session

from app.core.security import (
    InvalidAuthenticationTokenError,
    TokenType,
    decode_token,
)
from app.db.session import get_db_session
from app.models.user import User, UserRole


bearer_scheme = HTTPBearer(auto_error=False)


def authentication_error() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Требуется аутентификация",
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_active_user(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None,
        Depends(bearer_scheme),
    ],
    session: Annotated[
        Session,
        Depends(get_db_session),
    ],
) -> User:
    if credentials is None:
        raise authentication_error()

    try:
        claims = decode_token(
            credentials.credentials,
            expected_type=TokenType.ACCESS,
        )
    except InvalidAuthenticationTokenError:
        raise authentication_error()

    user = session.get(User, claims.user_id)

    if user is None:
        raise authentication_error()

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Пользователь отключён",
        )

    return user


CurrentUser = Annotated[
    User,
    Depends(get_current_active_user),
]


def require_admin(
    user: CurrentUser,
) -> User:
    if user.role != UserRole.ADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=("Действие доступно только администратору"),
        )

    return user


AdminUser = Annotated[
    User,
    Depends(require_admin),
]
