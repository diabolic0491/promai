from datetime import date, datetime
from decimal import Decimal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_validator,
)

from app.models.contract_party_role import (
    ContractPartyRole,
    ContractStatus,
)


class ContractStatusUpdate(BaseModel):
    status: ContractStatus


class ContractCreate(BaseModel):
    counterparty_id: int = Field(gt=0)

    number: str = Field(
        min_length=1,
        max_length=100,
    )

    title: str = Field(
        min_length=1,
        max_length=500,
    )

    contract_date: date

    start_date: date | None = None
    end_date: date | None = None

    amount: Decimal | None = Field(
        default=None,
        ge=0,
        max_digits=18,
        decimal_places=2,
    )

    currency: str = Field(
        default="BYN",
        min_length=3,
        max_length=3,
    )

    notes: str | None = None

    owner_role: ContractPartyRole = (
        ContractPartyRole.SUPPLIER
    )

    counterparty_role: ContractPartyRole = (
        ContractPartyRole.BUYER
    )

    @field_validator("number", "title")
    @classmethod
    def normalize_required_text(
        cls,
        value: str,
    ) -> str:
        normalized = value.strip()

        if not normalized:
            raise ValueError(
                "Поле не может быть пустым"
            )

        return normalized

    @field_validator("currency")
    @classmethod
    def normalize_currency(
        cls,
        value: str,
    ) -> str:
        normalized = value.strip().upper()

        if not normalized.isalpha():
            raise ValueError(
                "Код валюты должен состоять "
                "из трёх букв"
            )

        return normalized

    @field_validator("notes")
    @classmethod
    def normalize_notes(
        cls,
        value: str | None,
    ) -> str | None:
        if value is None:
            return None

        normalized = value.strip()
        return normalized or None

    @model_validator(mode="after")
    def validate_dates(self) -> "ContractCreate":
        if (
            self.start_date is not None
            and self.end_date is not None
            and self.end_date < self.start_date
        ):
            raise ValueError(
                "Дата окончания не может быть "
                "раньше даты начала"
            )

        return self


class ContractUpdate(BaseModel):
    number: str | None = Field(
        default=None,
        min_length=1,
        max_length=100,
    )

    title: str | None = Field(
        default=None,
        min_length=1,
        max_length=500,
    )

    contract_date: date | None = None
    start_date: date | None = None
    end_date: date | None = None

    amount: Decimal | None = Field(
        default=None,
        ge=0,
        max_digits=18,
        decimal_places=2,
    )

    currency: str | None = Field(
        default=None,
        min_length=3,
        max_length=3,
    )

    notes: str | None = None

    owner_role: ContractPartyRole | None = None
    counterparty_role: ContractPartyRole | None = None

    @field_validator("number", "title")
    @classmethod
    def normalize_required_text(
        cls,
        value: str | None,
    ) -> str | None:
        if value is None:
            return None

        normalized = value.strip()

        if not normalized:
            raise ValueError(
                "Поле не может быть пустым"
            )

        return normalized

    @field_validator("currency")
    @classmethod
    def normalize_currency(
        cls,
        value: str | None,
    ) -> str | None:
        if value is None:
            return None

        normalized = value.strip().upper()

        if not normalized.isalpha():
            raise ValueError(
                "Код валюты должен состоять "
                "из трёх букв"
            )

        return normalized

    @field_validator("notes")
    @classmethod
    def normalize_notes(
        cls,
        value: str | None,
    ) -> str | None:
        if value is None:
            return None

        normalized = value.strip()
        return normalized or None

    @model_validator(mode="after")
    def validate_dates(self) -> "ContractUpdate":
        if (
            self.start_date is not None
            and self.end_date is not None
            and self.end_date < self.start_date
        ):
            raise ValueError(
                "Дата окончания не может быть "
                "раньше даты начала"
            )

        return self


class ContractRead(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
    )

    id: int
    counterparty_id: int

    number: str
    title: str

    contract_date: date
    start_date: date | None
    end_date: date | None

    amount: Decimal | None
    currency: str
    status: ContractStatus
    notes: str | None

    owner_role: ContractPartyRole
    counterparty_role: ContractPartyRole

    created_at: datetime
    updated_at: datetime