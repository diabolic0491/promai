from datetime import datetime

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
)


class OrganizationProfileUpdate(BaseModel):
    name: str | None = Field(
        default=None,
        min_length=1,
        max_length=500,
    )

    short_name: str | None = Field(
        default=None,
        min_length=1,
        max_length=255,
    )

    unp: str | None = Field(
        default=None,
        max_length=50,
    )

    legal_address: str | None = None

    email: str | None = Field(
        default=None,
        max_length=255,
    )

    phone: str | None = Field(
        default=None,
        max_length=100,
    )

    director_name: str | None = Field(
        default=None,
        max_length=255,
    )

    director_position: str | None = Field(
        default=None,
        max_length=255,
    )

    bank_name: str | None = Field(
        default=None,
        max_length=500,
    )

    bank_account: str | None = Field(
        default=None,
        max_length=100,
    )

    bank_code: str | None = Field(
        default=None,
        max_length=100,
    )

    @field_validator(
        "name",
        "short_name",
        "unp",
        "legal_address",
        "email",
        "phone",
        "director_name",
        "director_position",
        "bank_name",
        "bank_account",
        "bank_code",
    )
    @classmethod
    def normalize_text(
        cls,
        value: str | None,
    ) -> str | None:
        if value is None:
            return None

        normalized = value.strip()
        return normalized or None


class OrganizationProfileRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    short_name: str
    unp: str | None
    legal_address: str | None
    email: str | None
    phone: str | None
    director_name: str | None
    director_position: str | None
    bank_name: str | None
    bank_account: str | None
    bank_code: str | None
    created_at: datetime
    updated_at: datetime