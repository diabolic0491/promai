import json
from dataclasses import dataclass
from pathlib import Path
from uuid import uuid4
from datetime import UTC, datetime

from docx import Document
from fastapi import UploadFile
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.document_template import (
    DocumentTemplate,
    DocumentTemplateType,
)
from app.schemas.document_template import (
    DocumentTemplateUpdate,
)
from app.services.pagination import (
    PageResult,
    paginate_scalars,
)
from app.services.technical_specification_docx import (
    get_invalid_template_variables,
    get_template_variables,
    is_valid_template_variable_name,
    normalize_required_variable,
)


settings = get_settings()

MAX_TEMPLATE_SIZE_BYTES = 10 * 1024 * 1024
DOCX_MEDIA_TYPE = (
    "application/vnd.openxmlformats-officedocument."
    "wordprocessingml.document"
)


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


class InvalidDocumentTemplateVariablesError(
    Exception
):
    def __init__(
        self,
        variable_names: list[str],
    ) -> None:
        self.variable_names = variable_names
        super().__init__(
            ", ".join(variable_names)
        )


class DocumentTemplateAlreadyActiveError(Exception):
    """Шаблон уже активен."""


class DocumentTemplateFileNotFoundError(Exception):
    """Файл шаблона отсутствует в хранилище."""


@dataclass(frozen=True)
class DocumentTemplateFile:
    path: Path
    file_name: str


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

        variable = normalize_required_variable(
            item
        )

        if not is_valid_template_variable_name(
            variable
        ):
            raise InvalidRequiredVariablesError

        if variable not in normalized:
            normalized.append(variable)

    return sorted(normalized)


def extract_docx_template_variables(
    file_path: Path,
) -> list[str]:
    try:
        document = Document(file_path)
    except Exception as error:
        raise InvalidDocumentTemplateFileError from error

    invalid_variables = sorted(
        get_invalid_template_variables(document)
    )

    if invalid_variables:
        raise InvalidDocumentTemplateVariablesError(
            invalid_variables
        )

    template_variables = get_template_variables(
        document
    )

    return sorted(template_variables)


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
        template_variables = (
            extract_docx_template_variables(
                stored_path
            )
        )
        required_variables = sorted(
            set(required_variables)
            | set(template_variables)
        )

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
    only_active: bool = False,
    search: str | None = None,
    limit: int = 20,
    offset: int = 0,
) -> PageResult[DocumentTemplate]:
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

    if only_active:
        statement = statement.where(
            DocumentTemplate.is_active.is_(True),
            DocumentTemplate.archived_at.is_(None),
        )

    if search:
        normalized_search = search.strip()
        statement = statement.where(
            or_(
                DocumentTemplate.name.ilike(
                    f"%{normalized_search}%"
                ),
                DocumentTemplate.file_name.ilike(
                    f"%{normalized_search}%"
                ),
            )
        )

    statement = statement.order_by(
        DocumentTemplate.id.desc()
    )

    return paginate_scalars(
        session=session,
        statement=statement,
        limit=limit,
        offset=offset,
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


def get_document_template_file(
    session: Session,
    template_id: int,
) -> DocumentTemplateFile:
    template = get_document_template_by_id(
        session=session,
        template_id=template_id,
    )
    templates_directory = (
        Path(settings.storage_root) / "templates"
    ).resolve()
    candidate = Path(template.storage_path).resolve()

    try:
        candidate.relative_to(templates_directory)
    except ValueError as error:
        raise DocumentTemplateFileNotFoundError from error

    if (
        not candidate.is_file()
        or candidate.suffix.lower() != ".docx"
    ):
        raise DocumentTemplateFileNotFoundError

    return DocumentTemplateFile(
        path=candidate,
        file_name=template.file_name,
    )


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
