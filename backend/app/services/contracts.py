from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.contract import Contract
from app.models.counterparty import Counterparty
from app.schemas.contract import (
    ContractCreate,
    ContractUpdate,
)

from app.models.enums import ( 
    ContractStatus,
)


class ContractNotFoundError(Exception):
    """Договор не найден."""


class ContractCounterpartyNotFoundError(Exception):
    """Контрагент для договора не найден."""


class EmptyContractUpdateError(Exception):
    """Не передано ни одного поля для изменения."""


class ContractAlreadyArchivedError(Exception):
    """Договор уже находится в архиве."""


class ContractAlreadyActiveError(Exception):
    """Договор уже активен."""


class InvalidContractDatesError(Exception):
    """Некорректный период действия договора."""


def create_contract(
    session: Session,
    payload: ContractCreate,
) -> Contract:
    counterparty = session.get(
        Counterparty,
        payload.counterparty_id,
    )

    if counterparty is None:
        raise ContractCounterpartyNotFoundError

    contract = Contract(
        counterparty_id=payload.counterparty_id,
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
        status=ContractStatus.DRAFT.value,
    )

    session.add(contract)
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
    elif not include_archived:
        statement = statement.where(
            Contract.status != ContractStatus.ARCHIVED.value
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


def update_contract(
    session: Session,
    contract_id: int,
    payload: ContractUpdate,
) -> Contract:
    contract = get_contract_by_id(
        session=session,
        contract_id=contract_id,
    )

    update_data = payload.model_dump(
        exclude_unset=True,
    )

    if not update_data:
        raise EmptyContractUpdateError

    prospective_start_date = update_data.get(
        "start_date",
        contract.start_date,
    )

    prospective_end_date = update_data.get(
        "end_date",
        contract.end_date,
    )

    if (
        prospective_start_date is not None
        and prospective_end_date is not None
        and prospective_end_date < prospective_start_date
    ):
        raise InvalidContractDatesError

    for field_name, value in update_data.items():
        setattr(contract, field_name, value)

    session.commit()
    session.refresh(contract)

    return contract


def archive_contract(
    session: Session,
    contract_id: int,
) -> Contract:
    contract = get_contract_by_id(
        session=session,
        contract_id=contract_id,
    )

    if contract.status == ContractStatus.ARCHIVED.value:
        raise ContractAlreadyArchivedError

    contract.status = ContractStatus.ARCHIVED.value

    session.commit()
    session.refresh(contract)

    return contract


def restore_contract(
    session: Session,
    contract_id: int,
) -> Contract:
    contract = get_contract_by_id(
        session=session,
        contract_id=contract_id,
    )

    if contract.status != ContractStatus.ARCHIVED.value:
        raise ContractAlreadyActiveError

    contract.status = ContractStatus.DRAFT.value

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
    ContractStatus.ARCHIVED: set(),
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
) -> Contract:
    contract = get_contract_by_id(
        session=session,
        contract_id=contract_id,
    )

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

    contract.status = target_status.value

    session.commit()
    session.refresh(contract)

    return contract