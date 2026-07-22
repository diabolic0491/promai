import json
from pathlib import Path
from uuid import uuid4
from datetime import UTC, datetime

from docx import Document
from fastapi import UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.document_template import (
    DocumentTemplate,
    DocumentTemplateType,
)
from app.schemas.document_template import (
    DocumentTemplateUpdate,
)


settings = get_settings()

MAX_TEMPLATE_SIZE_BYTES = 10 * 1024 * 1024


class DocumentTemplateNotFoundError(Exception):
    """Шаблон документа не найден."""


class DocumentTemplateAlreadyArchivedError(
    Exception
):
    """Шаблон уже находится в архиве."""


class DocumentTemplateNotArchivedError(Exception):
    """Шаблон не находится в архиве."""


class EmptyDocumentTemplateUpdateError(Exception):
    """Не передано ни одного поля для изменения."""


class InvalidDocumentTemplateFileError(Exception):
    """Файл не является корректным DOCX-шаблоном."""


class DocumentTemplateFileTooLargeError(Exception):
    """Размер файла шаблона превышает лимит."""


class InvalidRequiredVariablesError(Exception):
    """Некорректный список переменных шаблона."""

class DocumentTemplateAlreadyActiveError(Exception):
    """Шаблон уже активен."""


def parse_required_variables(
    raw_value: str,
) -> list[str]:
    try:
        parsed = json.loads(raw_value)
    except json.JSONDecodeError as error:
        raise InvalidRequiredVariablesError from error

    if not isinstance(parsed, list):
        raise InvalidRequiredVariablesError

    normalized: list[str] = []

    for item in parsed:
        if not isinstance(item, str):
            raise InvalidRequiredVariablesError

        variable = item.strip()

        if not variable:
            raise InvalidRequiredVariablesError

        if variable not in normalized:
            normalized.append(variable)

    return normalized


def validate_docx_file(
    file_path: Path,
) -> None:
    try:
        Document(file_path)
    except Exception as error:
        raise InvalidDocumentTemplateFileError from error


def create_document_template(
    session: Session,
    *,
    name: str,
    template_type: DocumentTemplateType,
    description: str | None,
    required_variables_raw: str,
    upload: UploadFile,
) -> DocumentTemplate:
    normalized_name = name.strip()

    if not normalized_name:
        raise ValueError(
            "Название шаблона не может быть пустым"
        )

    required_variables = parse_required_variables(
        required_variables_raw
    )

    original_file_name = (
        Path(upload.filename or "template.docx").name
    )

    if Path(original_file_name).suffix.lower() != ".docx":
        raise InvalidDocumentTemplateFileError

    content = upload.file.read(
        MAX_TEMPLATE_SIZE_BYTES + 1
    )

    if len(content) > MAX_TEMPLATE_SIZE_BYTES:
        raise DocumentTemplateFileTooLargeError

    templates_directory = (
        Path(settings.storage_root) / "templates"
    )

    templates_directory.mkdir(
        parents=True,
        exist_ok=True,
    )

    stored_file_name = f"{uuid4().hex}.docx"
    stored_path = (
        templates_directory / stored_file_name
    )

    try:
        stored_path.write_bytes(content)
        validate_docx_file(stored_path)

        template = DocumentTemplate(
            name=normalized_name,
            template_type=template_type.value,
            description=(
                description.strip()
                if description
                and description.strip()
                else None
            ),
            file_name=original_file_name,
            storage_path=str(stored_path),
            version=1,
            required_variables=required_variables,
            is_active=True,
        )

        session.add(template)
        session.commit()
        session.refresh(template)

        return template
    except Exception:
        session.rollback()

        if stored_path.exists():
            stored_path.unlink()

        raise


def list_document_templates(
    session: Session,
    *,
    template_type: DocumentTemplateType | None = None,
    include_archived: bool = False,
    limit: int = 20,
    offset: int = 0,
) -> list[DocumentTemplate]:
    statement = select(DocumentTemplate)

    if template_type is not None:
        statement = statement.where(
            DocumentTemplate.template_type
            == template_type.value
        )

    if not include_archived:
        statement = statement.where(
            DocumentTemplate.archived_at.is_(None)
        )

    statement = (
        statement
        .order_by(DocumentTemplate.id.desc())
        .offset(offset)
        .limit(limit)
    )

    return list(
        session.scalars(statement).all()
    )


def get_document_template_by_id(
    session: Session,
    template_id: int,
) -> DocumentTemplate:
    template = session.get(
        DocumentTemplate,
        template_id,
    )

    if template is None:
        raise DocumentTemplateNotFoundError

    return template


def update_document_template(
    session: Session,
    template_id: int,
    payload: DocumentTemplateUpdate,
) -> DocumentTemplate:
    template = get_document_template_by_id(
        session=session,
        template_id=template_id,
    )

    if template.archived_at is not None:
        raise DocumentTemplateAlreadyArchivedError

    update_data = payload.model_dump(
        exclude_unset=True,
    )

    if not update_data:
        raise EmptyDocumentTemplateUpdateError

    for field_name, value in update_data.items():
        setattr(template, field_name, value)

    session.commit()
    session.refresh(template)

    return template

def archive_document_template(
    session: Session,
    template_id: int,
) -> DocumentTemplate:
    template = get_document_template_by_id(
        session=session,
        template_id=template_id,
    )

    if template.archived_at is not None:
        raise DocumentTemplateAlreadyArchivedError

    template.archived_at = datetime.now(UTC)
    template.is_active = False

    session.commit()
    session.refresh(template)

    return template


def restore_document_template(
    session: Session,
    template_id: int,
) -> DocumentTemplate:
    template = get_document_template_by_id(
        session=session,
        template_id=template_id,
    )

    if template.archived_at is None:
        raise DocumentTemplateAlreadyActiveError

    template.archived_at = None
    template.is_active = True

    session.commit()
    session.refresh(template)

    return template