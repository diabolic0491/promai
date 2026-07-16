from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class CounterpartyCreate(BaseModel):
    unp: str = Field(
        min_length=9,
        max_length=9,
        examples=["100000000"],
    )

    name: str = Field(
        min_length=1,
        max_length=500,
    )

    short_name: str | None = Field(
        default=None,
        max_length=255,
    )

    legal_address: str | None = Field(
        default=None,
        max_length=500,
    )

    @field_validator("unp")
    @classmethod
    def validate_unp(cls, value: str) -> str:
        normalized = value.strip()

        if not normalized.isdigit():
            raise ValueError("УНП должен содержать только цифры")

        return normalized

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        normalized = value.strip()

        if not normalized:
            raise ValueError("Наименование не может быть пустым")

        return normalized

    @field_validator("short_name", "legal_address")
    @classmethod
    def normalize_optional_text(
        cls,
        value: str | None,
    ) -> str | None:
        if value is None:
            return None

        normalized = value.strip()
        return normalized or None
    
class CounterpartyUpdate(BaseModel):
    name: str | None = Field(
        default=None,
        min_length=1,
        max_length=500,
    )

    short_name: str | None = Field(
        default=None,
        max_length=255,
    )

    legal_address: str | None = Field(
        default=None,
        max_length=500,
    )

    @field_validator("name")
    @classmethod
    def normalize_name(
        cls,
        value: str | None,
    ) -> str | None:
        if value is None:
            return None

        normalized = value.strip()

        if not normalized:
            raise ValueError("Наименование не может быть пустым")

        return normalized

    @field_validator("short_name", "legal_address")
    @classmethod
    def normalize_optional_text(
        cls,
        value: str | None,
    ) -> str | None:
        if value is None:
            return None

        normalized = value.strip()
        return normalized or None


class CounterpartyRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    unp: str
    name: str
    short_name: str | None
    legal_address: str | None
    status: str
    created_at: datetime
    updated_at: datetime