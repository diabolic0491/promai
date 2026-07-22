from datetime import datetime

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
)

from app.models.document_template import (
    DocumentTemplateType,
)


class DocumentTemplateRead(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
    )

    id: int
    name: str
    template_type: DocumentTemplateType
    description: str | None

    file_name: str
    version: int
    required_variables: list[str]

    is_active: bool
    archived_at: datetime | None
    is_archived: bool

    created_at: datetime
    updated_at: datetime


class DocumentTemplateUpdate(BaseModel):
    name: str | None = Field(
        default=None,
        min_length=1,
        max_length=255,
    )

    description: str | None = None

    is_active: bool | None = None

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
            raise ValueError(
                "Название шаблона не может быть пустым"
            )

        return normalized

    @field_validator("description")
    @classmethod
    def normalize_description(
        cls,
        value: str | None,
    ) -> str | None:
        if value is None:
            return None

        normalized = value.strip()

        return normalized or None