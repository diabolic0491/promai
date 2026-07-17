from sqlalchemy.orm import Session

from app.models.organization_profile import OrganizationProfile
from app.schemas.organization_profile import (
    OrganizationProfileUpdate,
)


class OrganizationProfileNotFoundError(Exception):
    """Профиль предприятия не найден."""


class EmptyOrganizationProfileUpdateError(Exception):
    """Не передано ни одного поля для изменения."""


def get_organization_profile(
    session: Session,
) -> OrganizationProfile:
    profile = session.get(
        OrganizationProfile,
        1,
    )

    if profile is None:
        raise OrganizationProfileNotFoundError

    return profile


def update_organization_profile(
    session: Session,
    payload: OrganizationProfileUpdate,
) -> OrganizationProfile:
    profile = get_organization_profile(session)

    update_data = payload.model_dump(
        exclude_unset=True,
    )

    if not update_data:
        raise EmptyOrganizationProfileUpdateError

    if update_data.get("name") is None and "name" in update_data:
        raise ValueError(
            "Полное наименование не может быть пустым"
        )

    if (
        update_data.get("short_name") is None
        and "short_name" in update_data
    ):
        raise ValueError(
            "Краткое наименование не может быть пустым"
        )

    for field_name, value in update_data.items():
        setattr(profile, field_name, value)

    session.commit()
    session.refresh(profile)

    return profile