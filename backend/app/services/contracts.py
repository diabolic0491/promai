from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.contract import Contract
from app.models.contract_status_history import (
    ContractStatusHistory,
)
from app.models.counterparty import Counterparty
from app.models.enums import ContractStatus
from app.schemas.contract import (
    ContractCreate,
    ContractUpdate,
)
from app.services import contract_documents

from app.models.contract_event import (
    ContractEvent,
    ContractEventType,
)


class ContractNotFoundError(Exception):
    """Договор не найден."""


class ContractCounterpartyNotFoundError(Exception):
    """Контрагент для договора не найден."""

class ArchivedContractCounterpartyError(Exception):
    """Нельзя создать договор с архивным контрагентом."""


class EmptyContractUpdateError(Exception):
    """Не передано ни одного поля для изменения."""


class ContractAlreadyArchivedError(Exception):
    """Договор уже находится в архиве."""


class ContractNotArchivedError(Exception):
    """Договор не находится в архиве."""


class ArchivedContractModificationError(Exception):
    """Архивный договор нельзя изменять."""



class InvalidContractDatesError(Exception):
    """Некорректный период действия договора."""


class InvalidContractFormDataError(Exception):
    """Дополнительные данные договора нельзя очистить."""


def add_contract_event(
    session: Session,
    contract_id: int,
    event_type: ContractEventType,
    event_data: dict[str, Any] | None = None,
    actor_user_id: int | None = None,
) -> ContractEvent:
    event = ContractEvent(
        contract_id=contract_id,
        event_type=event_type.value,
        event_data=event_data,
        actor_user_id=actor_user_id,
    )

    session.add(event)

    return event

def create_contract(
    session: Session,
    payload: ContractCreate,
    *,
    actor_user_id: int,
) -> Contract:
    counterparty = session.get(
        Counterparty,
        payload.counterparty_id,
    )

    if counterparty is None:
        raise ContractCounterpartyNotFoundError

    if counterparty.status == "archived":
        raise ArchivedContractCounterpartyError

    if payload.template_id is not None:
        contract_documents.get_template_for_contract(
            session=session,
            template_id=payload.template_id,
        )

    contract = Contract(
        counterparty_id=payload.counterparty_id,
        template_id=payload.template_id,
        number=payload.number,
        title=payload.title,
        contract_date=payload.contract_date,
        start_date=payload.start_date,
        end_date=payload.end_date,
        amount=payload.amount,
        currency=payload.currency,
        notes=payload.notes,
        owner_role=payload.owner_role.value,
        counterparty_role=payload.counterparty_role.value,
        form_data=payload.form_data,
        status=ContractStatus.DRAFT.value,
    )

    session.add(contract)
    session.flush()

    history_entry = ContractStatusHistory(
        contract_id=contract.id,
        from_status=None,
        to_status=ContractStatus.DRAFT.value,
        changed_by_user_id=actor_user_id,
    )

    session.add(history_entry)
    add_contract_event(
        session=session,
        contract_id=contract.id,
        event_type=ContractEventType.CREATED,
        event_data={
            "initial_status": (
                ContractStatus.DRAFT.value
            ),
        },
        actor_user_id=actor_user_id,
    )
    session.commit()
    session.refresh(contract)

    return contract


def list_contracts(
    session: Session,
    counterparty_id: int | None = None,
    status: str | None = None,
    include_archived: bool = False,
    limit: int = 20,
    offset: int = 0,
) -> list[Contract]:
    statement = select(Contract)

    if counterparty_id is not None:
        statement = statement.where(
            Contract.counterparty_id == counterparty_id
        )

    if status is not None:
        statement = statement.where(
            Contract.status == status
        )

    if not include_archived:
        statement = statement.where(
            Contract.archived_at.is_(None)
        )

    statement = (
        statement
        .order_by(Contract.id.desc())
        .offset(offset)
        .limit(limit)
    )

    return list(session.scalars(statement).all())


def get_contract_by_id(
    session: Session,
    contract_id: int,
) -> Contract:
    contract = session.get(
        Contract,
        contract_id,
    )

    if contract is None:
        raise ContractNotFoundError

    return contract

def list_contract_status_history(
    session: Session,
    contract_id: int,
) -> list[ContractStatusHistory]:
    get_contract_by_id(
        session=session,
        contract_id=contract_id,
    )

    statement = (
        select(ContractStatusHistory)
        .where(
            ContractStatusHistory.contract_id
            == contract_id
        )
        .order_by(
            ContractStatusHistory.changed_at.desc(),
            ContractStatusHistory.id.desc(),
        )
    )
    return list(
        session.scalars(statement).all()
    )

def list_contract_events(
    session: Session,
    contract_id: int,
) -> list[ContractEvent]:
    get_contract_by_id(
        session=session,
        contract_id=contract_id,
    )

    statement = (
        select(ContractEvent)
        .where(
            ContractEvent.contract_id
            == contract_id
        )
        .order_by(
            ContractEvent.created_at.desc(),
            ContractEvent.id.desc(),
        )
    )

    return list(
        session.scalars(statement).all()
    )

    return list(
        session.scalars(statement).all()
    )


def update_contract(
    session: Session,
    contract_id: int,
    payload: ContractUpdate,
    *,
    actor_user_id: int,
) -> Contract:
    contract = get_contract_by_id(
        session=session,
        contract_id=contract_id,
    )

    if contract.archived_at is not None:
        raise ArchivedContractModificationError

    update_data = payload.model_dump(
        exclude_unset=True,
    )

    if not update_data:
        raise EmptyContractUpdateError

    if (
        "form_data" in update_data
        and update_data["form_data"] is None
    ):
        raise InvalidContractFormDataError

    prospective_template_id = update_data.get(
        "template_id",
        contract.template_id,
    )

    if prospective_template_id is not None:
        contract_documents.get_template_for_contract(
            session=session,
            template_id=prospective_template_id,
        )

    prospective_start_date = update_data.get(
        "start_date",
        contract.start_date,
    )

    prospective_end_date = update_data.get(
        "end_date",
        contract.end_date,
    )

    changed_fields = [
        field_name
        for field_name, value in update_data.items()
        if getattr(contract, field_name) != value
    ]

    if (
        prospective_start_date is not None
        and prospective_end_date is not None
        and prospective_end_date < prospective_start_date
    ):
        raise InvalidContractDatesError

    previous_generated_storage_path = (
        contract.generated_storage_path
    )

    for field_name, value in update_data.items():
        setattr(contract, field_name, value)

    if changed_fields:
        contract.generated_file_name = None
        contract.generated_storage_path = None

        add_contract_event(
            session=session,
            contract_id=contract.id,
            event_type=ContractEventType.UPDATED,
            event_data={
                "changed_fields": sorted(
                    changed_fields
                ),
            },
            actor_user_id=actor_user_id,
        )

    session.commit()
    session.refresh(contract)

    if changed_fields:
        contract_documents.remove_generated_file(
            previous_generated_storage_path
        )

    return contract


def archive_contract(
    session: Session,
    contract_id: int,
    *,
    actor_user_id: int,
) -> Contract:
    contract = get_contract_by_id(
        session=session,
        contract_id=contract_id,
    )

    if contract.archived_at is not None:
        raise ContractAlreadyArchivedError

    archived_at = datetime.now(UTC)
    contract.archived_at = archived_at

    add_contract_event(
        session=session,
        contract_id=contract.id,
        event_type=ContractEventType.ARCHIVED,
        event_data={
            "archived_at": (
                archived_at.isoformat()
            ),
            "status": contract.status,
        },
        actor_user_id=actor_user_id,
    )

    session.commit()
    session.refresh(contract)

    return contract


def restore_contract(
    session: Session,
    contract_id: int,
    *,
    actor_user_id: int,
) -> Contract:
    contract = get_contract_by_id(
        session=session,
        contract_id=contract_id,
    )

    if contract.archived_at is None:
        raise ContractNotArchivedError
    
    previous_archived_at = contract.archived_at
    contract.archived_at = None

    add_contract_event(
        session=session,
        contract_id=contract.id,
        event_type=ContractEventType.RESTORED,
        event_data={
            "previous_archived_at": (
                previous_archived_at.isoformat()
            ),
            "status": contract.status,
        },
        actor_user_id=actor_user_id,
    )

    session.commit()
    session.refresh(contract)

    return contract

ALLOWED_CONTRACT_STATUS_TRANSITIONS: dict[
    ContractStatus,
    set[ContractStatus],
] = {
    ContractStatus.DRAFT: {
        ContractStatus.PENDING_APPROVAL,
    },
    ContractStatus.PENDING_APPROVAL: {
        ContractStatus.DRAFT,
        ContractStatus.ACTIVE,
    },
    ContractStatus.ACTIVE: {
        ContractStatus.COMPLETED,
        ContractStatus.TERMINATED,
    },
    ContractStatus.COMPLETED: set(),
    ContractStatus.TERMINATED: set(),
        
}


class InvalidContractStatusTransitionError(Exception):
    def __init__(
        self,
        current_status: ContractStatus,
        target_status: ContractStatus,
    ) -> None:
        self.current_status = current_status
        self.target_status = target_status

        super().__init__(
            "Недопустимый переход статуса договора: "
            f"{current_status.value} → "
            f"{target_status.value}"
        )


def change_contract_status(
    session: Session,
    contract_id: int,
    target_status: ContractStatus,
    *,
    actor_user_id: int,
) -> Contract:
    contract = get_contract_by_id(
        session=session,
        contract_id=contract_id,
    )
    if contract.archived_at is not None:
        raise ArchivedContractModificationError

    current_status = ContractStatus(
        contract.status
    )

    if current_status == target_status:
        return contract

    allowed_statuses = (
        ALLOWED_CONTRACT_STATUS_TRANSITIONS[
            current_status
        ]
    )

    if target_status not in allowed_statuses:
        raise InvalidContractStatusTransitionError(
            current_status=current_status,
            target_status=target_status,
        )

    previous_status = current_status

    contract.status = target_status.value

    history_entry = ContractStatusHistory(
        contract_id=contract.id,
        from_status=previous_status.value,
        to_status=target_status.value,
        changed_by_user_id=actor_user_id,
    )

    session.add(history_entry)
    add_contract_event(
        session=session,
        contract_id=contract.id,
        event_type=(
            ContractEventType.STATUS_CHANGED
        ),
        event_data={
            "from_status": previous_status.value,
            "to_status": target_status.value,
        },
        actor_user_id=actor_user_id,
    )
    session.commit()
    session.refresh(contract)

    return contract
