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
from app.models.contract import Contract
from app.schemas.contract import (
    ContractCreate,
    ContractRead,
    ContractStatusUpdate,
    ContractUpdate,
)
from app.services import contracts as service


router = APIRouter(
    prefix="/contracts",
    tags=["Contracts"],
)

DatabaseSession = Annotated[
    Session,
    Depends(get_db_session),
]


@router.post(
    "",
    response_model=ContractRead,
    status_code=status.HTTP_201_CREATED,
)
def create_contract(
    payload: ContractCreate,
    session: DatabaseSession,
) -> Contract:
    try:
        return service.create_contract(
            session=session,
            payload=payload,
        )
    except service.ContractCounterpartyNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Контрагент для договора не найден",
        )


@router.get(
    "",
    response_model=list[ContractRead],
)
def list_contracts(
    session: DatabaseSession,
    counterparty_id: Annotated[
        int | None,
        Query(gt=0),
    ] = None,
    contract_status: Annotated[
        str | None,
        Query(
            alias="status",
            max_length=50,
        ),
    ] = None,
    include_archived: bool = False,
    limit: Annotated[
        int,
        Query(ge=1, le=100),
    ] = 20,
    offset: Annotated[
        int,
        Query(ge=0),
    ] = 0,
) -> list[Contract]:
    return service.list_contracts(
        session=session,
        counterparty_id=counterparty_id,
        status=contract_status,
        include_archived=include_archived,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/{contract_id}",
    response_model=ContractRead,
)
def get_contract(
    contract_id: int,
    session: DatabaseSession,
) -> Contract:
    try:
        return service.get_contract_by_id(
            session=session,
            contract_id=contract_id,
        )
    except service.ContractNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Договор не найден",
        )


@router.patch(
    "/{contract_id}",
    response_model=ContractRead,
)
def update_contract(
    contract_id: int,
    payload: ContractUpdate,
    session: DatabaseSession,
) -> Contract:
    try:
        return service.update_contract(
            session=session,
            contract_id=contract_id,
            payload=payload,
        )
    except service.ContractNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Договор не найден",
        )
    except service.EmptyContractUpdateError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Не передано ни одного поля "
                "для изменения"
            ),
        )
    except service.InvalidContractDatesError:
        raise HTTPException(
            status_code=(
                status.HTTP_422_UNPROCESSABLE_ENTITY
            ),
            detail=(
                "Дата окончания не может быть раньше "
                "даты начала"
            ),
        )


@router.patch(
    "/{contract_id}/status",
    response_model=ContractRead,
)
def update_contract_status(
    contract_id: int,
    payload: ContractStatusUpdate,
    session: DatabaseSession,
) -> Contract:
    try:
        return service.change_contract_status(
            session=session,
            contract_id=contract_id,
            target_status=payload.status,
        )
    except service.ContractNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Договор не найден",
        )
    except (
        service.InvalidContractStatusTransitionError
    ) as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(error),
        ) from error


@router.post(
    "/{contract_id}/archive",
    response_model=ContractRead,
)
def archive_contract(
    contract_id: int,
    session: DatabaseSession,
) -> Contract:
    try:
        return service.archive_contract(
            session=session,
            contract_id=contract_id,
        )
    except service.ContractNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Договор не найден",
        )
    except service.ContractAlreadyArchivedError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Договор уже находится в архиве",
        )


@router.post(
    "/{contract_id}/restore",
    response_model=ContractRead,
)
def restore_contract(
    contract_id: int,
    session: DatabaseSession,
) -> Contract:
    try:
        return service.restore_contract(
            session=session,
            contract_id=contract_id,
        )
    except service.ContractNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Договор не найден",
        )
    except service.ContractAlreadyActiveError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Договор не находится в архиве",
        )