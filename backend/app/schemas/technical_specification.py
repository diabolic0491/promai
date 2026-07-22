from datetime import date, datetime
from typing import Any

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_validator,
)

from app.models.technical_specification import (
    TechnicalSpecificationStatus,
)


class TechnicalSpecificationCreate(BaseModel):
    counterparty_id: int = Field(gt=0)

    contract_id: int | None = Field(
        default=None,
        gt=0,
    )

    template_id: int = Field(gt=0)

    title: str = Field(
        min_length=1,
        max_length=500,
    )

    procurement_subject: str = Field(
        min_length=1,
        max_length=1000,
    )

    procurement_procedure: str = Field(
        default="Открытый конкурс",
        min_length=1,
        max_length=255,
    )

    legal_basis: str = Field(
        min_length=1,
    )

    internal_regulation_document: str = Field(
        min_length=1,
    )

    approval_date: date | None = None
    work_start_date: date | None = None
    work_end_date: date | None = None

    form_data: dict[str, Any] = Field(
        default_factory=dict,
    )

    @field_validator(
        "title",
        "procurement_subject",
        "procurement_procedure",
        "legal_basis",
        "internal_regulation_document",
    )
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

    @model_validator(mode="after")
    def validate_work_dates(
        self,
    ) -> "TechnicalSpecificationCreate":
        if (
            self.work_start_date is not None
            and self.work_end_date is not None
            and self.work_end_date
            < self.work_start_date
        ):
            raise ValueError(
                "Дата окончания работ не может быть "
                "раньше даты начала"
            )

        return self


class TechnicalSpecificationUpdate(BaseModel):
    counterparty_id: int | None = Field(
        default=None,
        gt=0,
    )

    contract_id: int | None = Field(
        default=None,
        gt=0,
    )

    template_id: int | None = Field(
        default=None,
        gt=0,
    )

    title: str | None = Field(
        default=None,
        min_length=1,
        max_length=500,
    )

    procurement_subject: str | None = Field(
        default=None,
        min_length=1,
        max_length=1000,
    )

    procurement_procedure: str | None = Field(
        default=None,
        min_length=1,
        max_length=255,
    )

    legal_basis: str | None = Field(
        default=None,
        min_length=1,
    )

    internal_regulation_document: (
        str | None
    ) = Field(
        default=None,
        min_length=1,
    )

    approval_date: date | None = None
    work_start_date: date | None = None
    work_end_date: date | None = None

    form_data: dict[str, Any] | None = None

    @field_validator(
        "title",
        "procurement_subject",
        "procurement_procedure",
        "legal_basis",
        "internal_regulation_document",
    )
    @classmethod
    def normalize_optional_text(
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


class TechnicalSpecificationRead(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
    )

    id: int

    counterparty_id: int
    contract_id: int | None
    template_id: int

    title: str
    procurement_subject: str
    procurement_procedure: str

    legal_basis: str
    internal_regulation_document: str

    approval_date: date | None
    work_start_date: date | None
    work_end_date: date | None

    status: TechnicalSpecificationStatus

    form_data: dict[str, Any]

    generated_file_name: str | None
    generated_storage_path: str | None

    archived_at: datetime | None
    is_archived: bool

    created_at: datetime
    updated_at: datetime