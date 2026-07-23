from datetime import datetime

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
)

from app.models.user import UserRole


def normalize_username(value: str) -> str:
    normalized = value.strip().lower()

    if not normalized:
        raise ValueError("Имя пользователя не может быть пустым")

    if any(character.isspace() for character in normalized):
        raise ValueError("Имя пользователя не должно содержать пробелы")

    return normalized


class UserCreate(BaseModel):
    username: str = Field(
        min_length=3,
        max_length=100,
    )
    full_name: str | None = Field(
        default=None,
        max_length=255,
    )
    password: str = Field(
        min_length=12,
        max_length=128,
    )
    role: UserRole = UserRole.MANAGER
    is_active: bool = True

    @field_validator("username")
    @classmethod
    def validate_username(
        cls,
        value: str,
    ) -> str:
        return normalize_username(value)

    @field_validator("full_name")
    @classmethod
    def normalize_full_name(
        cls,
        value: str | None,
    ) -> str | None:
        if value is None:
            return None

        normalized = value.strip()
        return normalized or None


class UserUpdate(BaseModel):
    full_name: str | None = Field(
        default=None,
        max_length=255,
    )
    password: str | None = Field(
        default=None,
        min_length=12,
        max_length=128,
    )
    role: UserRole | None = None
    is_active: bool | None = None

    @field_validator("full_name")
    @classmethod
    def normalize_full_name(
        cls,
        value: str | None,
    ) -> str | None:
        if value is None:
            return None

        normalized = value.strip()
        return normalized or None


class UserRead(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
    )

    id: int
    username: str
    full_name: str | None
    role: UserRole
    is_active: bool
    last_login_at: datetime | None
    created_at: datetime
    updated_at: datetime
