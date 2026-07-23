from typing import Annotated

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)
from sqlalchemy.orm import Session

from app.db.session import get_db_session
from app.api.dependencies.auth import (
    AdminUser,
    get_current_active_user,
)
from app.models.organization_profile import OrganizationProfile
from app.schemas.organization_profile import (
    OrganizationProfileRead,
    OrganizationProfileUpdate,
)
from app.services import organization_profile as service


router = APIRouter(
    prefix="/organization-profile",
    tags=["Organization profile"],
    dependencies=[
        Depends(get_current_active_user),
    ],
)

DatabaseSession = Annotated[
    Session,
    Depends(get_db_session),
]


@router.get(
    "",
    response_model=OrganizationProfileRead,
)
def get_organization_profile(
    session: DatabaseSession,
) -> OrganizationProfile:
    try:
        return service.get_organization_profile(session)
    except service.OrganizationProfileNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Профиль предприятия не найден",
        )


@router.patch(
    "",
    response_model=OrganizationProfileRead,
)
def update_organization_profile(
    payload: OrganizationProfileUpdate,
    _: AdminUser,
    session: DatabaseSession,
) -> OrganizationProfile:
    try:
        return service.update_organization_profile(
            session=session,
            payload=payload,
        )
    except service.OrganizationProfileNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Профиль предприятия не найден",
        )
    except service.EmptyOrganizationProfileUpdateError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Не передано ни одного поля для изменения",
        )
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        )
