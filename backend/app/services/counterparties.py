from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.counterparty import Counterparty
from app.schemas.counterparty import (
    CounterpartyCreate,
    CounterpartyUpdate,
)


class CounterpartyAlreadyExistsError(Exception):
    """Контрагент с таким УНП уже существует."""


class CounterpartyNotFoundError(Exception):
    """Контрагент не найден."""


class CounterpartyAlreadyArchivedError(Exception):
    """Контрагент уже находится в архиве."""


class CounterpartyAlreadyActiveError(Exception):
    """Контрагент уже активен."""


class EmptyCounterpartyUpdateError(Exception):
    """Не передано ни одного поля для обновления."""


def create_counterparty(
    session: Session,
    payload: CounterpartyCreate,
) -> Counterparty:
    existing = session.scalar(
        select(Counterparty).where(
            Counterparty.unp == payload.unp
        )
    )

    if existing is not None:
        raise CounterpartyAlreadyExistsError

    counterparty = Counterparty(
        unp=payload.unp,
        name=payload.name,
        short_name=payload.short_name,
        legal_address=payload.legal_address,
    )

    session.add(counterparty)

    try:
        session.commit()
    except IntegrityError as error:
        session.rollback()
        raise CounterpartyAlreadyExistsError from error

    session.refresh(counterparty)

    return counterparty


def list_counterparties(
    session: Session,
    search: str | None = None,
    limit: int = 20,
    offset: int = 0,
    include_archived: bool = False,
) -> list[Counterparty]:
    statement = select(Counterparty)

    if not include_archived:
        statement = statement.where(
            Counterparty.status == "active"
        )

    if search:
        normalized_search = search.strip()

        statement = statement.where(
            or_(
                Counterparty.unp.ilike(
                    f"%{normalized_search}%"
                ),
                Counterparty.name.ilike(
                    f"%{normalized_search}%"
                ),
                Counterparty.short_name.ilike(
                    f"%{normalized_search}%"
                ),
            )
        )

    statement = (
        statement
        .order_by(Counterparty.id.desc())
        .offset(offset)
        .limit(limit)
    )

    return list(session.scalars(statement).all())


def get_counterparty_by_id(
    session: Session,
    counterparty_id: int,
) -> Counterparty:
    counterparty = session.get(
        Counterparty,
        counterparty_id,
    )

    if counterparty is None:
        raise CounterpartyNotFoundError

    return counterparty


def get_counterparty_by_unp(
    session: Session,
    unp: str,
) -> Counterparty:
    counterparty = session.scalar(
        select(Counterparty).where(
            Counterparty.unp == unp
        )
    )

    if counterparty is None:
        raise CounterpartyNotFoundError

    return counterparty


def update_counterparty(
    session: Session,
    counterparty_id: int,
    payload: CounterpartyUpdate,
) -> Counterparty:
    counterparty = get_counterparty_by_id(
        session=session,
        counterparty_id=counterparty_id,
    )

    update_data = payload.model_dump(
        exclude_unset=True,
    )

    if not update_data:
        raise EmptyCounterpartyUpdateError

    for field_name, value in update_data.items():
        setattr(counterparty, field_name, value)

    session.commit()
    session.refresh(counterparty)

    return counterparty


def archive_counterparty(
    session: Session,
    counterparty_id: int,
) -> Counterparty:
    counterparty = get_counterparty_by_id(
        session=session,
        counterparty_id=counterparty_id,
    )

    if counterparty.status == "archived":
        raise CounterpartyAlreadyArchivedError

    counterparty.status = "archived"

    session.commit()
    session.refresh(counterparty)

    return counterparty


def restore_counterparty(
    session: Session,
    counterparty_id: int,
) -> Counterparty:
    counterparty = get_counterparty_by_id(
        session=session,
        counterparty_id=counterparty_id,
    )

    if counterparty.status == "active":
        raise CounterpartyAlreadyActiveError

    counterparty.status = "active"

    session.commit()
    session.refresh(counterparty)

    return counterparty