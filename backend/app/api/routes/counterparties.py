from typing import Annotated

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    status,
)
from sqlalchemy.orm import Session

from app.db.session import get_db_session
from app.models.counterparty import Counterparty
from app.schemas.counterparty import (
    CounterpartyCreate,
    CounterpartyRead,
    CounterpartyUpdate,
)
from app.services import counterparties as service


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
    try:
        return service.create_counterparty(
            session=session,
            payload=payload,
        )
    except service.CounterpartyAlreadyExistsError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Контрагент с таким УНП уже существует",
        )


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
    return service.list_counterparties(
        session=session,
        search=search,
        limit=limit,
        offset=offset,
        include_archived=include_archived,
    )


@router.get(
    "/by-unp/{unp}",
    response_model=CounterpartyRead,
)
def get_counterparty_by_unp(
    unp: str,
    session: DatabaseSession,
) -> Counterparty:
    try:
        return service.get_counterparty_by_unp(
            session=session,
            unp=unp,
        )
    except service.CounterpartyNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Контрагент не найден",
        )


@router.patch(
    "/{counterparty_id}",
    response_model=CounterpartyRead,
)
def update_counterparty(
    counterparty_id: int,
    payload: CounterpartyUpdate,
    session: DatabaseSession,
) -> Counterparty:
    try:
        return service.update_counterparty(
            session=session,
            counterparty_id=counterparty_id,
            payload=payload,
        )
    except service.CounterpartyNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Контрагент не найден",
        )
    except service.EmptyCounterpartyUpdateError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Не передано ни одного поля для изменения",
        )


@router.post(
    "/{counterparty_id}/archive",
    response_model=CounterpartyRead,
)
def archive_counterparty(
    counterparty_id: int,
    session: DatabaseSession,
) -> Counterparty:
    try:
        return service.archive_counterparty(
            session=session,
            counterparty_id=counterparty_id,
        )
    except service.CounterpartyNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Контрагент не найден",
        )
    except service.CounterpartyAlreadyArchivedError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Контрагент уже находится в архиве",
        )


@router.post(
    "/{counterparty_id}/restore",
    response_model=CounterpartyRead,
)
def restore_counterparty(
    counterparty_id: int,
    session: DatabaseSession,
) -> Counterparty:
    try:
        return service.restore_counterparty(
            session=session,
            counterparty_id=counterparty_id,
        )
    except service.CounterpartyNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Контрагент не найден",
        )
    except service.CounterpartyAlreadyActiveError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Контрагент уже активен",
        )


@router.get(
    "/{counterparty_id}",
    response_model=CounterpartyRead,
)
def get_counterparty(
    counterparty_id: int,
    session: DatabaseSession,
) -> Counterparty:
    try:
        return service.get_counterparty_by_id(
            session=session,
            counterparty_id=counterparty_id,
        )
    except service.CounterpartyNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Контрагент не найден",
        )