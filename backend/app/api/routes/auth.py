from typing import Annotated

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Response,
    status,
)
from sqlalchemy.orm import Session

from app.api.dependencies.auth import CurrentUser
from app.db.session import get_db_session
from app.schemas.auth import (
    LoginRequest,
    RefreshTokenRequest,
    TokenPair,
)
from app.schemas.user import UserRead
from app.services import auth as service


router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)

DatabaseSession = Annotated[
    Session,
    Depends(get_db_session),
]


@router.post(
    "/login",
    response_model=TokenPair,
)
def login(
    payload: LoginRequest,
    session: DatabaseSession,
) -> TokenPair:
    try:
        return service.authenticate_user(
            session=session,
            username=payload.username,
            password=payload.password,
        )
    except service.InvalidCredentialsError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=("Неверное имя пользователя или пароль"),
            headers={"WWW-Authenticate": "Bearer"},
        )
    except service.InactiveUserError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Пользователь отключён",
        )


@router.post(
    "/refresh",
    response_model=TokenPair,
)
def refresh(
    payload: RefreshTokenRequest,
    session: DatabaseSession,
) -> TokenPair:
    try:
        return service.rotate_refresh_token(
            session=session,
            raw_refresh_token=(payload.refresh_token),
        )
    except service.InvalidRefreshTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh-токен недействителен",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except service.InactiveUserError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Пользователь отключён",
        )


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
)
def logout(
    payload: RefreshTokenRequest,
    current_user: CurrentUser,
    session: DatabaseSession,
) -> Response:
    service.revoke_refresh_token(
        session=session,
        raw_refresh_token=payload.refresh_token,
        actor_user_id=current_user.id,
    )

    return Response(
        status_code=status.HTTP_204_NO_CONTENT,
    )


@router.get(
    "/me",
    response_model=UserRead,
)
def get_me(
    current_user: CurrentUser,
) -> object:
    return current_user
