import re
from dataclasses import dataclass
from datetime import UTC, date, datetime
from pathlib import Path
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.contract import Contract
from app.models.counterparty import Counterparty
from app.models.document_template import (
    DocumentTemplate,
    DocumentTemplateType,
)
from app.models.organization_profile import (
    OrganizationProfile,
)
from app.models.technical_specification import (
    TechnicalSpecification,
    TechnicalSpecificationStatus,
)
from app.schemas.technical_specification import (
    TechnicalSpecificationCreate,
    TechnicalSpecificationUpdate,
)
from app.services.technical_specification_docx import (
    InvalidDocxTemplateError,
    MissingTemplateVariablesError,
    add_approval_date_variables,
    flatten_form_data,
    format_date,
    render_docx_template,
)


settings = get_settings()

DOCX_MEDIA_TYPE = (
    "application/vnd.openxmlformats-officedocument."
    "wordprocessingml.document"
)


@dataclass(frozen=True)
class GeneratedTechnicalSpecificationFile:
    path: Path
    file_name: str


class TechnicalSpecificationNotFoundError(
    Exception
):
    """Техническое задание не найдено."""


class TechnicalSpecificationCounterpartyNotFoundError(
    Exception
):
    """Контрагент для ТЗ не найден."""


class ArchivedTechnicalSpecificationCounterpartyError(
    Exception
):
    """Нельзя использовать архивного контрагента."""


class TechnicalSpecificationContractNotFoundError(
    Exception
):
    """Связанный договор не найден."""


class TechnicalSpecificationContractMismatchError(
    Exception
):
    """Договор относится к другому контрагенту."""


class ArchivedTechnicalSpecificationContractError(
    Exception
):
    """Нельзя использовать архивный договор."""


class TechnicalSpecificationTemplateNotFoundError(
    Exception
):
    """Шаблон документа не найден."""


class InvalidTechnicalSpecificationTemplateTypeError(
    Exception
):
    """Шаблон не предназначен для ТЗ."""


class InactiveTechnicalSpecificationTemplateError(
    Exception
):
    """Шаблон выключен или находится в архиве."""


class EmptyTechnicalSpecificationUpdateError(
    Exception
):
    """Не передано ни одного поля для изменения."""


class ArchivedTechnicalSpecificationModificationError(
    Exception
):
    """Архивное ТЗ нельзя изменять."""


class TechnicalSpecificationAlreadyArchivedError(
    Exception
):
    """ТЗ уже находится в архиве."""


class TechnicalSpecificationNotArchivedError(
    Exception
):
    """ТЗ не находится в архиве."""


class InvalidTechnicalSpecificationDatesError(
    Exception
):
    """Дата окончания работ раньше даты начала."""


class ArchivedTechnicalSpecificationGenerationError(
    Exception
):
    """Архивное ТЗ нельзя сгенерировать."""


class TechnicalSpecificationTemplateFileNotFoundError(
    Exception
):
    """Файл DOCX-шаблона отсутствует в хранилище."""


class MissingTechnicalSpecificationTemplateVariablesError(
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


class InvalidTechnicalSpecificationDocxTemplateError(
    Exception
):
    """Файл шаблона нельзя обработать как DOCX."""


class GeneratedTechnicalSpecificationFileNotFoundError(
    Exception
):
    """Сгенерированный DOCX-файл отсутствует."""


def validate_work_dates(
    start_date: date | None,
    end_date: date | None,
) -> None:
    if (
        start_date is not None
        and end_date is not None
        and end_date < start_date
    ):
        raise InvalidTechnicalSpecificationDatesError


def get_counterparty_for_technical_specification(
    session: Session,
    counterparty_id: int,
) -> Counterparty:
    counterparty = session.get(
        Counterparty,
        counterparty_id,
    )

    if counterparty is None:
        raise (
            TechnicalSpecificationCounterpartyNotFoundError
        )

    if counterparty.status == "archived":
        raise (
            ArchivedTechnicalSpecificationCounterpartyError
        )

    return counterparty


def get_contract_for_technical_specification(
    session: Session,
    contract_id: int | None,
    counterparty_id: int,
) -> Contract | None:
    if contract_id is None:
        return None

    contract = session.get(
        Contract,
        contract_id,
    )

    if contract is None:
        raise TechnicalSpecificationContractNotFoundError

    if contract.archived_at is not None:
        raise ArchivedTechnicalSpecificationContractError

    if contract.counterparty_id != counterparty_id:
        raise TechnicalSpecificationContractMismatchError

    return contract


def get_template_for_technical_specification(
    session: Session,
    template_id: int,
) -> DocumentTemplate:
    template = session.get(
        DocumentTemplate,
        template_id,
    )

    if template is None:
        raise TechnicalSpecificationTemplateNotFoundError

    if (
        template.template_type
        != DocumentTemplateType
        .TECHNICAL_SPECIFICATION
        .value
    ):
        raise InvalidTechnicalSpecificationTemplateTypeError

    if (
        not template.is_active
        or template.archived_at is not None
    ):
        raise InactiveTechnicalSpecificationTemplateError

    return template


def add_present_values(
    target: dict[str, object],
    source: dict[str, object | None],
) -> None:
    target.update(
        {
            key: value
            for key, value in source.items()
            if value is not None
        }
    )


def build_technical_specification_template_values(
    technical_specification: TechnicalSpecification,
    *,
    counterparty: Counterparty,
    contract: Contract | None,
    organization: OrganizationProfile | None,
) -> dict[str, object]:
    values: dict[str, object] = flatten_form_data(
        technical_specification.form_data
    )

    add_present_values(
        values,
        {
            "tz.id": technical_specification.id,
            "tz.title": technical_specification.title,
            "tz.procurement_subject": (
                technical_specification.procurement_subject
            ),
            "tz.procurement_procedure": (
                technical_specification.procurement_procedure
            ),
            "tz.legal_basis": (
                technical_specification.legal_basis
            ),
            "tz.internal_regulation_document": (
                technical_specification
                .internal_regulation_document
            ),
            "tz.approval_date": format_date(
                technical_specification.approval_date
            ),
            "tz.work_start_date": format_date(
                technical_specification.work_start_date
            ),
            "tz.work_end_date": format_date(
                technical_specification.work_end_date
            ),
            "tz.status": technical_specification.status,
            "title": technical_specification.title,
            "procurement_subject": (
                technical_specification.procurement_subject
            ),
            "procurement_procedure": (
                technical_specification.procurement_procedure
            ),
            "legal_basis": (
                technical_specification.legal_basis
            ),
            "internal_regulation_document": (
                technical_specification
                .internal_regulation_document
            ),
            "procurement.procedure": (
                technical_specification.procurement_procedure
            ),
            "procurement.legal_basis": (
                technical_specification.legal_basis
            ),
            "procurement.internal_regulation_document": (
                technical_specification
                .internal_regulation_document
            ),
            "work.start_date": format_date(
                technical_specification.work_start_date
            ),
            "work.end_date": format_date(
                technical_specification.work_end_date
            ),
        },
    )

    add_approval_date_variables(
        values,
        technical_specification.approval_date,
    )

    add_present_values(
        values,
        {
            "counterparty.id": counterparty.id,
            "counterparty.unp": counterparty.unp,
            "counterparty.name": counterparty.name,
            "counterparty.full_name": counterparty.name,
            "counterparty.short_name": (
                counterparty.short_name
            ),
            "counterparty.legal_address": (
                counterparty.legal_address
            ),
        },
    )

    if contract is not None:
        add_present_values(
            values,
            {
                "contract.id": contract.id,
                "contract.number": contract.number,
                "contract.title": contract.title,
                "contract.date": format_date(
                    contract.contract_date
                ),
                "contract.start_date": format_date(
                    contract.start_date
                ),
                "contract.end_date": format_date(
                    contract.end_date
                ),
                "contract.amount": contract.amount,
                "contract.currency": contract.currency,
                "contract.status": contract.status,
            },
        )

    if organization is not None:
        add_present_values(
            values,
            {
                "organization.id": organization.id,
                "organization.name": organization.name,
                "organization.full_name": (
                    organization.name
                ),
                "organization.short_name": (
                    organization.short_name
                ),
                "organization.unp": organization.unp,
                "organization.legal_address": (
                    organization.legal_address
                ),
                "organization.email": organization.email,
                "organization.phone": organization.phone,
                "organization.director_name": (
                    organization.director_name
                ),
                "organization.director_position": (
                    organization.director_position
                ),
                "organization.bank_name": (
                    organization.bank_name
                ),
                "organization.bank_account": (
                    organization.bank_account
                ),
                "organization.bank_code": (
                    organization.bank_code
                ),
            },
        )

    return values


def build_generated_file_name(
    technical_specification: TechnicalSpecification,
) -> str:
    safe_title = re.sub(
        r'[<>:"/\\|?*\x00-\x1f]+',
        "_",
        technical_specification.title,
    )
    safe_title = re.sub(
        r"\s+",
        " ",
        safe_title,
    ).strip(" ._")

    if not safe_title:
        safe_title = "техническое задание"

    prefix = (
        f"Техническое задание {technical_specification.id} — "
    )
    max_title_length = 250 - len(prefix)

    return (
        prefix
        + safe_title[:max_title_length].rstrip(" .")
        + ".docx"
    )


def get_generated_files_directory() -> Path:
    return (
        Path(settings.storage_root)
        / "generated"
        / "technical-specifications"
    ).resolve()


def resolve_generated_file_path(
    raw_path: str,
) -> Path:
    generated_directory = (
        get_generated_files_directory()
    )
    candidate = Path(raw_path).resolve()

    try:
        candidate.relative_to(generated_directory)
    except ValueError as error:
        raise (
            GeneratedTechnicalSpecificationFileNotFoundError
        ) from error

    if (
        not candidate.is_file()
        or candidate.suffix.lower() != ".docx"
    ):
        raise (
            GeneratedTechnicalSpecificationFileNotFoundError
        )

    return candidate


def remove_previous_generated_file(
    raw_path: str | None,
    *,
    current_path: Path,
) -> None:
    if raw_path is None:
        return

    try:
        previous_path = resolve_generated_file_path(
            raw_path
        )
    except GeneratedTechnicalSpecificationFileNotFoundError:
        return

    if previous_path != current_path:
        try:
            previous_path.unlink(missing_ok=True)
        except OSError:
            return


def remove_generated_file(
    raw_path: str | None,
) -> None:
    if raw_path is None:
        return

    try:
        generated_path = resolve_generated_file_path(
            raw_path
        )
    except GeneratedTechnicalSpecificationFileNotFoundError:
        return

    try:
        generated_path.unlink(missing_ok=True)
    except OSError:
        return


def create_technical_specification(
    session: Session,
    payload: TechnicalSpecificationCreate,
) -> TechnicalSpecification:
    get_counterparty_for_technical_specification(
        session=session,
        counterparty_id=payload.counterparty_id,
    )

    get_contract_for_technical_specification(
        session=session,
        contract_id=payload.contract_id,
        counterparty_id=payload.counterparty_id,
    )

    get_template_for_technical_specification(
        session=session,
        template_id=payload.template_id,
    )

    validate_work_dates(
        start_date=payload.work_start_date,
        end_date=payload.work_end_date,
    )

    technical_specification = (
        TechnicalSpecification(
            counterparty_id=payload.counterparty_id,
            contract_id=payload.contract_id,
            template_id=payload.template_id,
            title=payload.title,
            procurement_subject=(
                payload.procurement_subject
            ),
            procurement_procedure=(
                payload.procurement_procedure
            ),
            legal_basis=payload.legal_basis,
            internal_regulation_document=(
                payload.internal_regulation_document
            ),
            approval_date=payload.approval_date,
            work_start_date=payload.work_start_date,
            work_end_date=payload.work_end_date,
            status=(
                TechnicalSpecificationStatus
                .DRAFT
                .value
            ),
            form_data=payload.form_data,
        )
    )

    session.add(technical_specification)
    session.commit()
    session.refresh(technical_specification)

    return technical_specification


def list_technical_specifications(
    session: Session,
    *,
    counterparty_id: int | None = None,
    contract_id: int | None = None,
    template_id: int | None = None,
    technical_specification_status: (
        TechnicalSpecificationStatus | None
    ) = None,
    include_archived: bool = False,
    limit: int = 20,
    offset: int = 0,
) -> list[TechnicalSpecification]:
    statement = select(
        TechnicalSpecification
    )

    if counterparty_id is not None:
        statement = statement.where(
            TechnicalSpecification.counterparty_id
            == counterparty_id
        )

    if contract_id is not None:
        statement = statement.where(
            TechnicalSpecification.contract_id
            == contract_id
        )

    if template_id is not None:
        statement = statement.where(
            TechnicalSpecification.template_id
            == template_id
        )

    if technical_specification_status is not None:
        statement = statement.where(
            TechnicalSpecification.status
            == technical_specification_status.value
        )

    if not include_archived:
        statement = statement.where(
            TechnicalSpecification.archived_at
            .is_(None)
        )

    statement = (
        statement
        .order_by(
            TechnicalSpecification.id.desc()
        )
        .offset(offset)
        .limit(limit)
    )

    return list(
        session.scalars(statement).all()
    )


def get_technical_specification_by_id(
    session: Session,
    technical_specification_id: int,
) -> TechnicalSpecification:
    technical_specification = session.get(
        TechnicalSpecification,
        technical_specification_id,
    )

    if technical_specification is None:
        raise TechnicalSpecificationNotFoundError

    return technical_specification


def update_technical_specification(
    session: Session,
    technical_specification_id: int,
    payload: TechnicalSpecificationUpdate,
) -> TechnicalSpecification:
    technical_specification = (
        get_technical_specification_by_id(
            session=session,
            technical_specification_id=(
                technical_specification_id
            ),
        )
    )

    if technical_specification.archived_at is not None:
        raise (
            ArchivedTechnicalSpecificationModificationError
        )

    update_data = payload.model_dump(
        exclude_unset=True,
    )

    if not update_data:
        raise EmptyTechnicalSpecificationUpdateError

    prospective_counterparty_id = (
        update_data.get(
            "counterparty_id",
            technical_specification.counterparty_id,
        )
    )

    if prospective_counterparty_id is None:
        raise (
            TechnicalSpecificationCounterpartyNotFoundError
        )

    prospective_contract_id = update_data.get(
        "contract_id",
        technical_specification.contract_id,
    )

    prospective_template_id = update_data.get(
        "template_id",
        technical_specification.template_id,
    )

    get_counterparty_for_technical_specification(
        session=session,
        counterparty_id=prospective_counterparty_id,
    )

    get_contract_for_technical_specification(
        session=session,
        contract_id=prospective_contract_id,
        counterparty_id=prospective_counterparty_id,
    )

    get_template_for_technical_specification(
        session=session,
        template_id=prospective_template_id,
    )

    prospective_start_date = update_data.get(
        "work_start_date",
        technical_specification.work_start_date,
    )

    prospective_end_date = update_data.get(
        "work_end_date",
        technical_specification.work_end_date,
    )

    validate_work_dates(
        start_date=prospective_start_date,
        end_date=prospective_end_date,
    )

    non_nullable_fields = {
        "counterparty_id",
        "template_id",
        "title",
        "procurement_subject",
        "procurement_procedure",
        "legal_basis",
        "internal_regulation_document",
        "form_data",
    }

    for field_name in non_nullable_fields:
        if (
            field_name in update_data
            and update_data[field_name] is None
        ):
            raise ValueError(
                f"Поле {field_name} нельзя очистить"
            )

    previous_generated_storage_path = (
        technical_specification.generated_storage_path
    )

    for field_name, value in update_data.items():
        setattr(
            technical_specification,
            field_name,
            value,
        )

    technical_specification.generated_file_name = None
    technical_specification.generated_storage_path = None

    session.commit()
    session.refresh(technical_specification)

    remove_generated_file(
        previous_generated_storage_path
    )

    return technical_specification


def archive_technical_specification(
    session: Session,
    technical_specification_id: int,
) -> TechnicalSpecification:
    technical_specification = (
        get_technical_specification_by_id(
            session=session,
            technical_specification_id=(
                technical_specification_id
            ),
        )
    )

    if technical_specification.archived_at is not None:
        raise TechnicalSpecificationAlreadyArchivedError

    technical_specification.archived_at = (
        datetime.now(UTC)
    )

    session.commit()
    session.refresh(technical_specification)

    return technical_specification


def restore_technical_specification(
    session: Session,
    technical_specification_id: int,
) -> TechnicalSpecification:
    technical_specification = (
        get_technical_specification_by_id(
            session=session,
            technical_specification_id=(
                technical_specification_id
            ),
        )
    )

    if technical_specification.archived_at is None:
        raise TechnicalSpecificationNotArchivedError

    technical_specification.archived_at = None

    session.commit()
    session.refresh(technical_specification)

    return technical_specification


def generate_technical_specification_docx(
    session: Session,
    technical_specification_id: int,
) -> GeneratedTechnicalSpecificationFile:
    technical_specification = (
        get_technical_specification_by_id(
            session=session,
            technical_specification_id=(
                technical_specification_id
            ),
        )
    )

    if technical_specification.archived_at is not None:
        raise (
            ArchivedTechnicalSpecificationGenerationError
        )

    counterparty = (
        get_counterparty_for_technical_specification(
            session=session,
            counterparty_id=(
                technical_specification.counterparty_id
            ),
        )
    )
    contract = get_contract_for_technical_specification(
        session=session,
        contract_id=technical_specification.contract_id,
        counterparty_id=(
            technical_specification.counterparty_id
        ),
    )
    template = get_template_for_technical_specification(
        session=session,
        template_id=technical_specification.template_id,
    )
    template_path = Path(template.storage_path)

    if not template_path.is_file():
        raise (
            TechnicalSpecificationTemplateFileNotFoundError
        )

    organization = session.get(
        OrganizationProfile,
        1,
    )
    values = (
        build_technical_specification_template_values(
            technical_specification,
            counterparty=counterparty,
            contract=contract,
            organization=organization,
        )
    )
    generated_directory = (
        get_generated_files_directory()
    )
    output_path = (
        generated_directory
        / f"{uuid4().hex}.docx"
    )

    try:
        render_docx_template(
            template_path=template_path,
            output_path=output_path,
            values=values,
            required_variables=(
                template.required_variables
            ),
        )
    except MissingTemplateVariablesError as error:
        raise (
            MissingTechnicalSpecificationTemplateVariablesError(
                error.variable_names
            )
        ) from error
    except InvalidDocxTemplateError as error:
        raise (
            InvalidTechnicalSpecificationDocxTemplateError
        ) from error

    previous_storage_path = (
        technical_specification.generated_storage_path
    )
    generated_file_name = build_generated_file_name(
        technical_specification
    )
    technical_specification.generated_file_name = (
        generated_file_name
    )
    technical_specification.generated_storage_path = str(
        output_path
    )

    try:
        session.commit()
        session.refresh(technical_specification)
    except Exception:
        session.rollback()
        output_path.unlink(missing_ok=True)
        raise

    remove_previous_generated_file(
        previous_storage_path,
        current_path=output_path,
    )

    return GeneratedTechnicalSpecificationFile(
        path=output_path,
        file_name=generated_file_name,
    )


def get_generated_technical_specification_docx(
    session: Session,
    technical_specification_id: int,
) -> GeneratedTechnicalSpecificationFile:
    technical_specification = (
        get_technical_specification_by_id(
            session=session,
            technical_specification_id=(
                technical_specification_id
            ),
        )
    )

    if (
        technical_specification.generated_storage_path
        is None
        or technical_specification.generated_file_name
        is None
    ):
        raise (
            GeneratedTechnicalSpecificationFileNotFoundError
        )

    path = resolve_generated_file_path(
        technical_specification.generated_storage_path
    )

    return GeneratedTechnicalSpecificationFile(
        path=path,
        file_name=(
            technical_specification.generated_file_name
        ),
    )
