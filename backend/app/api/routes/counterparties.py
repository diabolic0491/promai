from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.session import get_db_session
from app.models.counterparty import Counterparty
from app.schemas.counterparty import (
    CounterpartyCreate,
    CounterpartyRead,
    CounterpartyUpdate,
)


router = APIRouter(
    prefix="/counterparties",
    tags=["Counterparties"],
)

DatabaseSession = Annotated[
    Session,
    Depends(get_db_session),
]


@router.post(
    "",
    response_model=CounterpartyRead,
    status_code=status.HTTP_201_CREATED,
)
def create_counterparty(
    payload: CounterpartyCreate,
    session: DatabaseSession,
) -> Counterparty:
    existing = session.scalar(
        select(Counterparty).where(
            Counterparty.unp == payload.unp
        )
    )

    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Контрагент с таким УНП уже существует",
        )

    counterparty = Counterparty(
        unp=payload.unp,
        name=payload.name,
        short_name=payload.short_name,
        legal_address=payload.legal_address,
    )

    session.add(counterparty)

    try:
        session.commit()
    except IntegrityError:
        session.rollback()

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Контрагент с таким УНП уже существует",
        )

    session.refresh(counterparty)
    return counterparty

@router.patch(
    "/{counterparty_id}",
    response_model=CounterpartyRead,
)
def update_counterparty(
    counterparty_id: int,
    payload: CounterpartyUpdate,
    session: DatabaseSession,
) -> Counterparty:
    counterparty = session.get(
        Counterparty,
        counterparty_id,
    )

    if counterparty is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Контрагент не найден",
        )

    update_data = payload.model_dump(
        exclude_unset=True,
    )

    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Не передано ни одного поля для изменения",
        )

    for field_name, value in update_data.items():
        setattr(counterparty, field_name, value)

    session.commit()
    session.refresh(counterparty)

    return counterparty
@router.post(
    "/{counterparty_id}/archive",
    response_model=CounterpartyRead,
)
def archive_counterparty(
    counterparty_id: int,
    session: DatabaseSession,
) -> Counterparty:
    counterparty = session.get(
        Counterparty,
        counterparty_id,
    )

    if counterparty is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Контрагент не найден",
        )

    if counterparty.status == "archived":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Контрагент уже находится в архиве",
        )

    counterparty.status = "archived"

    session.commit()
    session.refresh(counterparty)

    return counterparty
@router.post(
    "/{counterparty_id}/restore",
    response_model=CounterpartyRead,
)
def restore_counterparty(
    counterparty_id: int,
    session: DatabaseSession,
) -> Counterparty:
    counterparty = session.get(
        Counterparty,
        counterparty_id,
    )

    if counterparty is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Контрагент не найден",
        )

    if counterparty.status == "active":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Контрагент уже активен",
        )

    counterparty.status = "active"

    session.commit()
    session.refresh(counterparty)

    return counterparty


@router.get(
    "",
    response_model=list[CounterpartyRead],
)
def list_counterparties(
    session: DatabaseSession,
    search: Annotated[
        str | None,
        Query(
            min_length=1,
            max_length=500,
            description="Поиск по УНП или наименованию",
        ),
    ] = None,
    limit: Annotated[
        int,
        Query(ge=1, le=100),
    ] = 20,
    offset: Annotated[
        int,
        Query(ge=0),
    ] = 0,
    include_archived: Annotated[
        bool,
        Query(
            description="Показывать архивных контрагентов",
        ),
    ] = False,
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


@router.get(
    "/by-unp/{unp}",
    response_model=CounterpartyRead,
)
def get_counterparty_by_unp(
    unp: str,
    session: DatabaseSession,
) -> Counterparty:
    counterparty = session.scalar(
        select(Counterparty).where(
            Counterparty.unp == unp
        )
    )

    if counterparty is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Контрагент не найден",
        )

    return counterparty


@router.get(
    "/{counterparty_id}",
    response_model=CounterpartyRead,
)
def get_counterparty(
    counterparty_id: int,
    session: DatabaseSession,
) -> Counterparty:
    counterparty = session.get(
        Counterparty,
        counterparty_id,
    )

    if counterparty is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Контрагент не найден",
        )

    return counterparty