from typing import Annotated

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    status,
)
from sqlalchemy.orm import Session

from app.api.dependencies.auth import AdminUser
from app.db.session import get_db_session
from app.models.user import User, UserRole
from app.schemas.user import (
    UserCreate,
    UserRead,
    UserUpdate,
)
from app.schemas.pagination import Page
from app.services import users as service


router = APIRouter(
    prefix="/users",
    tags=["Users"],
)

DatabaseSession = Annotated[
    Session,
    Depends(get_db_session),
]


def raise_user_service_error(
    error: Exception,
) -> None:
    if isinstance(
        error,
        service.UserNotFoundError,
    ):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пользователь не найден",
        )

    if isinstance(
        error,
        service.UserAlreadyExistsError,
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Имя пользователя уже занято",
        )

    if isinstance(
        error,
        service.EmptyUserUpdateError,
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=("Не передано ни одного поля для изменения"),
        )

    if isinstance(
        error,
        (
            service.LastActiveAdminError,
            service.SelfDeactivationError,
            service.SelfRoleChangeError,
        ),
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(error),
        )

    raise error


@router.post(
    "",
    response_model=UserRead,
    status_code=status.HTTP_201_CREATED,
)
def create_user(
    payload: UserCreate,
    _: AdminUser,
    session: DatabaseSession,
) -> User:
    try:
        return service.create_user(
            session=session,
            payload=payload,
        )
    except Exception as error:
        raise_user_service_error(error)


@router.get(
    "",
    response_model=Page[UserRead],
)
def list_users(
    _: AdminUser,
    session: DatabaseSession,
    role: UserRole | None = None,
    is_active: bool | None = None,
    search: Annotated[
        str | None,
        Query(
            min_length=1,
            max_length=255,
        ),
    ] = None,
    limit: Annotated[
        int,
        Query(ge=1, le=200),
    ] = 100,
    offset: Annotated[
        int,
        Query(ge=0),
    ] = 0,
) -> Page[UserRead]:
    result = service.list_users(
        session=session,
        role=role,
        is_active=is_active,
        search=search,
        limit=limit,
        offset=offset,
    )
    return Page[UserRead](
        items=result.items,
        total=result.total,
        limit=result.limit,
        offset=result.offset,
    )


@router.get(
    "/{user_id}",
    response_model=UserRead,
)
def get_user(
    user_id: int,
    _: AdminUser,
    session: DatabaseSession,
) -> User:
    try:
        return service.get_user_by_id(
            session=session,
            user_id=user_id,
        )
    except Exception as error:
        raise_user_service_error(error)


@router.patch(
    "/{user_id}",
    response_model=UserRead,
)
def update_user(
    user_id: int,
    payload: UserUpdate,
    current_admin: AdminUser,
    session: DatabaseSession,
) -> User:
    try:
        return service.update_user(
            session=session,
            user_id=user_id,
            payload=payload,
            actor_user_id=current_admin.id,
        )
    except Exception as error:
        raise_user_service_error(error)
