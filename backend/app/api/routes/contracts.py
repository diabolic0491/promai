from typing import Annotated

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    status,
)
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.db.session import get_db_session
from app.models.contract import Contract
from app.models.contract_event import ContractEvent
from app.models.contract_status_history import (
    ContractStatusHistory,
)
from app.models.enums import ContractStatus
from app.schemas.contract import (
    ContractCreate,
    ContractEventRead,
    ContractRead,
    ContractStatusHistoryRead,
    ContractStatusUpdate,
    ContractUpdate,
)
from app.services import contracts as service
from app.services import contract_documents


router = APIRouter(
    prefix="/contracts",
    tags=["Contracts"],
)

DatabaseSession = Annotated[
    Session,
    Depends(get_db_session),
]


def raise_contract_document_service_error(
    error: Exception,
) -> None:
    if isinstance(
        error,
        contract_documents.ContractDocumentNotFoundError,
    ):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Договор не найден",
        )

    if isinstance(
        error,
        contract_documents.ContractTemplateNotFoundError,
    ):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Шаблон документа не найден",
        )

    if isinstance(
        error,
        contract_documents.ContractDocumentCounterpartyNotFoundError,
    ):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Контрагент не найден",
        )

    if isinstance(
        error,
        contract_documents.ContractTemplateNotSelectedError,
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Для договора не выбран шаблон",
        )

    if isinstance(
        error,
        contract_documents.InvalidContractTemplateTypeError,
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Выбранный шаблон не предназначен "
                "для договоров"
            ),
        )

    if isinstance(
        error,
        contract_documents.InactiveContractTemplateError,
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Шаблон выключен или находится "
                "в архиве"
            ),
        )

    if isinstance(
        error,
        contract_documents.ArchivedContractGenerationError,
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Архивный договор сначала "
                "необходимо восстановить"
            ),
        )

    if isinstance(
        error,
        contract_documents.ContractTemplateFileNotFoundError,
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Файл шаблона отсутствует "
                "в хранилище"
            ),
        )

    if isinstance(
        error,
        contract_documents.MissingContractTemplateVariablesError,
    ):
        raise HTTPException(
            status_code=(
                status.HTTP_422_UNPROCESSABLE_ENTITY
            ),
            detail={
                "message": (
                    "Не заполнены обязательные "
                    "переменные шаблона"
                ),
                "missing_variables": (
                    error.variable_names
                ),
            },
        )

    if isinstance(
        error,
        contract_documents.InvalidContractDocxTemplateError,
    ):
        raise HTTPException(
            status_code=(
                status.HTTP_422_UNPROCESSABLE_ENTITY
            ),
            detail=(
                "Не удалось обработать DOCX-шаблон"
            ),
        )

    if isinstance(
        error,
        contract_documents.GeneratedContractFileNotFoundError,
    ):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                "Сгенерированный DOCX-файл не найден"
            ),
        )

    raise error


def create_contract_docx_file_response(
    generated_file: contract_documents.GeneratedContractFile,
) -> FileResponse:
    return FileResponse(
        path=generated_file.path,
        media_type=contract_documents.DOCX_MEDIA_TYPE,
        filename=generated_file.file_name,
    )


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
            detail="Контрагент не найден",
        )
    except service.ArchivedContractCounterpartyError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Нельзя создать договор "
                "с архивным контрагентом"
            ),
        )
    except Exception as error:
        raise_contract_document_service_error(error)


@router.get(
    "/{contract_id}/status-history",
    response_model=list[ContractStatusHistoryRead],
)
def get_contract_status_history(
    contract_id: int,
    session: DatabaseSession,
) -> list[ContractStatusHistory]:
    try:
        return service.list_contract_status_history(
            session=session,
            contract_id=contract_id,
        )
    except service.ContractNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Договор не найден",
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
        ContractStatus | None,
        Query(alias="status"),
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
                status=(
            contract_status.value
            if contract_status is not None
            else None
        ),
        include_archived=include_archived,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/{contract_id}/events",
    response_model=list[ContractEventRead],
)
def get_contract_events(
    contract_id: int,
    session: DatabaseSession,
) -> list[ContractEvent]:
    try:
        return service.list_contract_events(
            session=session,
            contract_id=contract_id,
        )
    except service.ContractNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Договор не найден",
        )


@router.post(
    "/{contract_id}/generate",
    response_class=FileResponse,
)
def generate_contract_docx(
    contract_id: int,
    session: DatabaseSession,
) -> FileResponse:
    try:
        generated_file = (
            contract_documents.generate_contract_docx(
                session=session,
                contract_id=contract_id,
            )
        )
    except Exception as error:
        raise_contract_document_service_error(error)

    return create_contract_docx_file_response(
        generated_file
    )


@router.get(
    "/{contract_id}/download",
    response_class=FileResponse,
)
def download_contract_docx(
    contract_id: int,
    session: DatabaseSession,
) -> FileResponse:
    try:
        generated_file = (
            contract_documents.get_generated_contract_docx(
                session=session,
                contract_id=contract_id,
            )
        )
    except Exception as error:
        raise_contract_document_service_error(error)

    return create_contract_docx_file_response(
        generated_file
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
    except service.ArchivedContractModificationError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
    "Архивный договор сначала "
    "нужно восстановить"
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
    except service.InvalidContractFormDataError:
        raise HTTPException(
            status_code=(
                status.HTTP_422_UNPROCESSABLE_ENTITY
            ),
            detail=(
                "Дополнительные данные договора "
                "нельзя очистить"
            ),
        )
    except Exception as error:
        raise_contract_document_service_error(error)


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
    except service.ArchivedContractModificationError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Архивный договор сначала "
                "нужно восстановить"
            ),
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
    except service.ContractNotArchivedError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Договор не находится в архиве",
        )
