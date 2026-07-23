import re
from dataclasses import dataclass
from pathlib import Path
from uuid import uuid4

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.contract import Contract
from app.models.contract_event import (
    ContractEvent,
    ContractEventType,
)
from app.models.counterparty import Counterparty
from app.models.document_template import (
    DocumentTemplate,
    DocumentTemplateType,
)
from app.models.organization_profile import (
    OrganizationProfile,
)
from app.services.technical_specification_docx import (
    InvalidDocxTemplateError,
    MissingTemplateVariablesError,
    RUSSIAN_MONTHS,
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
class GeneratedContractFile:
    path: Path
    file_name: str


class ContractDocumentNotFoundError(Exception):
    """Договор не найден."""


class ContractTemplateNotSelectedError(Exception):
    """Для договора не выбран шаблон."""


class ContractTemplateNotFoundError(Exception):
    """Шаблон договора не найден."""


class InvalidContractTemplateTypeError(Exception):
    """Шаблон не предназначен для договора."""


class InactiveContractTemplateError(Exception):
    """Шаблон выключен или находится в архиве."""


class ArchivedContractGenerationError(Exception):
    """Архивный договор нельзя сгенерировать."""


class ContractDocumentCounterpartyNotFoundError(
    Exception
):
    """Контрагент договора не найден."""


class ContractTemplateFileNotFoundError(Exception):
    """Файл DOCX-шаблона отсутствует в хранилище."""


class MissingContractTemplateVariablesError(
    Exception
):
    def __init__(
        self,
        variable_names: list[str],
    ) -> None:
        self.variable_names = variable_names
        super().__init__(", ".join(variable_names))


class InvalidContractDocxTemplateError(Exception):
    """Файл шаблона нельзя обработать как DOCX."""


class GeneratedContractFileNotFoundError(Exception):
    """Сгенерированный DOCX-файл отсутствует."""


def get_contract_by_id(
    session: Session,
    contract_id: int,
) -> Contract:
    contract = session.get(Contract, contract_id)

    if contract is None:
        raise ContractDocumentNotFoundError

    return contract


def get_template_for_contract(
    session: Session,
    template_id: int,
) -> DocumentTemplate:
    template = session.get(
        DocumentTemplate,
        template_id,
    )

    if template is None:
        raise ContractTemplateNotFoundError

    if (
        template.template_type
        != DocumentTemplateType.CONTRACT.value
    ):
        raise InvalidContractTemplateTypeError

    if (
        not template.is_active
        or template.archived_at is not None
    ):
        raise InactiveContractTemplateError

    return template


def get_counterparty_for_contract(
    session: Session,
    counterparty_id: int,
) -> Counterparty:
    counterparty = session.get(
        Counterparty,
        counterparty_id,
    )

    if counterparty is None:
        raise ContractDocumentCounterpartyNotFoundError

    return counterparty


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


def add_contract_date_variables(
    values: dict[str, object],
    contract: Contract,
) -> None:
    contract_date = contract.contract_date
    values.update(
        {
            "contract.date": format_date(
                contract_date
            ),
            "contract.contract_date": format_date(
                contract_date
            ),
            "contract.day": (
                f"{contract_date.day:02d}"
            ),
            "contract.month": RUSSIAN_MONTHS[
                contract_date.month - 1
            ],
            "contract.year": str(
                contract_date.year
            ),
        }
    )


def build_contract_template_values(
    contract: Contract,
    *,
    counterparty: Counterparty,
    organization: OrganizationProfile | None,
) -> dict[str, object]:
    values: dict[str, object] = flatten_form_data(
        contract.form_data
    )

    add_present_values(
        values,
        {
            "contract.id": contract.id,
            "contract.number": contract.number,
            "contract.title": contract.title,
            "contract.start_date": format_date(
                contract.start_date
            ),
            "contract.end_date": format_date(
                contract.end_date
            ),
            "contract.amount": contract.amount,
            "contract.currency": contract.currency,
            "contract.status": contract.status,
            "contract.notes": contract.notes,
            "contract.owner_role": contract.owner_role,
            "contract.counterparty_role": (
                contract.counterparty_role
            ),
        },
    )
    add_contract_date_variables(values, contract)

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
            "counterparty.address": (
                counterparty.legal_address
            ),
            "counterparty.status": counterparty.status,
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
                "organization.address": (
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
                "organization.bank": (
                    organization.bank_name
                ),
                "organization.bank_account": (
                    organization.bank_account
                ),
                "organization.account": (
                    organization.bank_account
                ),
                "organization.bank_code": (
                    organization.bank_code
                ),
                "organization.bic": (
                    organization.bank_code
                ),
            },
        )

    return values


def build_generated_file_name(
    contract: Contract,
) -> str:
    safe_number = re.sub(
        r'[<>:"/\\|?*\x00-\x1f]+',
        "_",
        contract.number,
    )
    safe_number = re.sub(
        r"\s+",
        " ",
        safe_number,
    ).strip(" ._")

    if not safe_number:
        safe_number = str(contract.id)

    prefix = "Договор № "
    max_number_length = 250 - len(prefix)

    return (
        prefix
        + safe_number[:max_number_length].rstrip(" .")
        + ".docx"
    )


def get_generated_files_directory() -> Path:
    return (
        Path(settings.storage_root)
        / "generated"
        / "contracts"
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
        raise GeneratedContractFileNotFoundError from error

    if (
        not candidate.is_file()
        or candidate.suffix.lower() != ".docx"
    ):
        raise GeneratedContractFileNotFoundError

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
    except GeneratedContractFileNotFoundError:
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
    except GeneratedContractFileNotFoundError:
        return

    try:
        generated_path.unlink(missing_ok=True)
    except OSError:
        return


def generate_contract_docx(
    session: Session,
    contract_id: int,
) -> GeneratedContractFile:
    contract = get_contract_by_id(
        session=session,
        contract_id=contract_id,
    )

    if contract.archived_at is not None:
        raise ArchivedContractGenerationError

    if contract.template_id is None:
        raise ContractTemplateNotSelectedError

    counterparty = get_counterparty_for_contract(
        session=session,
        counterparty_id=contract.counterparty_id,
    )
    template = get_template_for_contract(
        session=session,
        template_id=contract.template_id,
    )
    template_path = Path(template.storage_path)

    if not template_path.is_file():
        raise ContractTemplateFileNotFoundError

    organization = session.get(
        OrganizationProfile,
        1,
    )
    values = build_contract_template_values(
        contract,
        counterparty=counterparty,
        organization=organization,
    )
    output_path = (
        get_generated_files_directory()
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
        raise MissingContractTemplateVariablesError(
            error.variable_names
        ) from error
    except InvalidDocxTemplateError as error:
        raise InvalidContractDocxTemplateError from error

    previous_storage_path = (
        contract.generated_storage_path
    )
    generated_file_name = build_generated_file_name(
        contract
    )
    contract.generated_file_name = generated_file_name
    contract.generated_storage_path = str(output_path)

    event = ContractEvent(
        contract_id=contract.id,
        event_type=ContractEventType.GENERATED.value,
        event_data={
            "template_id": template.id,
            "generated_file_name": generated_file_name,
            "replaced_previous_file": (
                previous_storage_path is not None
            ),
        },
    )
    session.add(event)

    try:
        session.commit()
        session.refresh(contract)
    except Exception:
        session.rollback()
        output_path.unlink(missing_ok=True)
        raise

    remove_previous_generated_file(
        previous_storage_path,
        current_path=output_path,
    )

    return GeneratedContractFile(
        path=output_path,
        file_name=generated_file_name,
    )


def get_generated_contract_docx(
    session: Session,
    contract_id: int,
) -> GeneratedContractFile:
    contract = get_contract_by_id(
        session=session,
        contract_id=contract_id,
    )

    if (
        contract.generated_storage_path is None
        or contract.generated_file_name is None
    ):
        raise GeneratedContractFileNotFoundError

    path = resolve_generated_file_path(
        contract.generated_storage_path
    )

    return GeneratedContractFile(
        path=path,
        file_name=contract.generated_file_name,
    )
