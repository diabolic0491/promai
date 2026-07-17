from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.contract import Contract
from app.models.counterparty import Counterparty
from app.schemas.contract import (
    ContractCreate,
    ContractUpdate,
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
            Contract.status != "archived"
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

    if contract.status == "archived":
        raise ContractAlreadyArchivedError

    contract.status = "archived"

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

    if contract.status != "archived":
        raise ContractAlreadyActiveError

    contract.status = "draft"

    session.commit()
    session.refresh(contract)

    return contract