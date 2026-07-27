from typing import Annotated

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Path,
    Query,
    UploadFile,
    status,
)
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.dependencies.auth import (
    CurrentUser,
    get_current_active_user,
)
from app.core.config import Settings, get_settings
from app.db.session import get_db_session
from app.models.contract import Contract
from app.models.contract_document_version import (
    ContractDocumentVersion,
)
from app.models.contract_event import ContractEvent
from app.models.contract_status_history import (
    ContractStatusHistory,
)
from app.models.enums import ContractStatus
from app.schemas.contract import (
    ContractCreate,
    ContractDocumentVersionRead,
    ContractEventRead,
    ContractRead,
    ContractStatusHistoryRead,
    ContractStatusUpdate,
    ContractUpdate,
)
from app.schemas.contract_analysis import (
    ContractAnalysisRunRead,
    ContractAnalysisRunSummaryRead,
)
from app.services import (
    contract_analysis_executor,
    contract_analysis_runs,
    contract_documents,
)
from app.services import contracts as service

router = APIRouter(
    prefix="/contracts",
    tags=["Contracts"],
    dependencies=[
        Depends(get_current_active_user),
    ],
)

DatabaseSession = Annotated[
    Session,
    Depends(get_db_session),
]


def provide_contract_analysis_execution_context(
    settings: Annotated[
        Settings,
        Depends(get_settings),
    ],
) -> (
    contract_analysis_executor
    .ContractAnalysisExecutionContext
):
    try:
        return (
            contract_analysis_executor
            .get_contract_analysis_execution_context(
                settings
            )
        )
    except (
        contract_analysis_executor
        .ContractAnalysisDisabledError
    ):
        raise HTTPException(
            status_code=(
                status.HTTP_503_SERVICE_UNAVAILABLE
            ),
            detail="Анализ договоров выключен",
        )
    except (
        contract_analysis_executor
        .ContractAnalysisConfigurationError
    ):
        raise HTTPException(
            status_code=(
                status.HTTP_503_SERVICE_UNAVAILABLE
            ),
            detail=(
                "Анализ договоров не настроен"
            ),
        )


AnalysisExecutionContext = Annotated[
    (
        contract_analysis_executor
        .ContractAnalysisExecutionContext
    ),
    Depends(
        provide_contract_analysis_execution_context
    ),
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
        (
            contract_documents
            .ArchivedContractGenerationError,
            contract_documents.ArchivedContractUploadError,
        ),
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

    if isinstance(
        error,
        contract_documents.ContractDocumentVersionNotFoundError,
    ):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                "Версия документа договора не найдена"
            ),
        )

    if isinstance(
        error,
        contract_documents
        .InvalidUploadedContractDocumentError,
    ):
        raise HTTPException(
            status_code=(
                status.HTTP_422_UNPROCESSABLE_ENTITY
            ),
            detail=(
                "Необходимо загрузить корректный "
                "DOCX-файл"
            ),
        )

    if isinstance(
        error,
        contract_documents
        .UploadedContractDocumentTooLargeError,
    ):
        raise HTTPException(
            status_code=(
                status.HTTP_413_REQUEST_ENTITY_TOO_LARGE
            ),
            detail=(
                "Размер документа превышает 10 МБ"
            ),
        )

    raise error


def raise_contract_analysis_service_error(
    error: Exception,
) -> None:
    if isinstance(
        error,
        contract_analysis_runs
        .ContractAnalysisRunNotFoundError,
    ):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Запуск анализа не найден",
        )

    if isinstance(
        error,
        contract_analysis_runs
        .ContractAnalysisAlreadyRunningError,
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Другой анализ договоров уже "
                "выполняется"
            ),
        )

    if isinstance(
        error,
        contract_analysis_runs
        .ContractAnalysisExecutionFailedError,
    ):
        raise HTTPException(
            status_code=error.http_status_code,
            detail={
                "message": error.public_message,
                "analysis_id": error.analysis_id,
                "status": "failed",
                "error_code": error.code,
            },
        )

    raise_contract_document_service_error(error)


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
    current_user: CurrentUser,
    session: DatabaseSession,
) -> Contract:
    try:
        return service.create_contract(
            session=session,
            payload=payload,
            actor_user_id=current_user.id,
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
    "/{contract_id}/versions",
    response_model=list[ContractDocumentVersionRead],
)
def get_contract_document_versions(
    contract_id: int,
    session: DatabaseSession,
    limit: Annotated[
        int,
        Query(ge=1, le=100),
    ] = 100,
    offset: Annotated[
        int,
        Query(ge=0),
    ] = 0,
) -> list[ContractDocumentVersion]:
    try:
        return (
            contract_documents
            .list_contract_document_versions(
                session=session,
                contract_id=contract_id,
                limit=limit,
                offset=offset,
            )
        )
    except Exception as error:
        raise_contract_document_service_error(error)


@router.post(
    "/{contract_id}/versions/upload",
    response_model=ContractDocumentVersionRead,
    status_code=status.HTTP_201_CREATED,
)
def upload_contract_document_version(
    contract_id: int,
    current_user: CurrentUser,
    session: DatabaseSession,
    file: Annotated[
        UploadFile,
        File(),
    ],
) -> ContractDocumentVersion:
    try:
        return (
            contract_documents
            .upload_contract_document_version(
                session=session,
                contract_id=contract_id,
                actor_user_id=current_user.id,
                upload=file,
            )
        )
    except Exception as error:
        raise_contract_document_service_error(error)
    finally:
        file.file.close()


@router.get(
    "/{contract_id}/versions/{version_number}/download",
    response_class=FileResponse,
)
def download_contract_document_version(
    contract_id: int,
    version_number: Annotated[int, Path(gt=0)],
    session: DatabaseSession,
) -> FileResponse:
    try:
        generated_file = (
            contract_documents
            .get_contract_document_version_docx(
                session=session,
                contract_id=contract_id,
                version_number=version_number,
            )
        )
    except Exception as error:
        raise_contract_document_service_error(error)

    return create_contract_docx_file_response(
        generated_file
    )


@router.post(
    (
        "/{contract_id}/versions/{version_number}"
        "/analyses"
    ),
    response_model=ContractAnalysisRunRead,
    status_code=status.HTTP_201_CREATED,
)
def create_contract_analysis(
    contract_id: int,
    version_number: Annotated[int, Path(gt=0)],
    current_user: CurrentUser,
    session: DatabaseSession,
    execution_context: AnalysisExecutionContext,
):
    try:
        return (
            contract_analysis_runs
            .run_contract_analysis(
                session=session,
                contract_id=contract_id,
                version_number=version_number,
                actor_user_id=current_user.id,
                execution_context=(
                    execution_context
                ),
            )
        )
    except Exception as error:  # noqa: BLE001
        raise_contract_analysis_service_error(
            error
        )


@router.get(
    (
        "/{contract_id}/versions/{version_number}"
        "/analyses"
    ),
    response_model=list[
        ContractAnalysisRunSummaryRead
    ],
)
def get_contract_analyses(
    contract_id: int,
    version_number: Annotated[int, Path(gt=0)],
    session: DatabaseSession,
    limit: Annotated[
        int,
        Query(ge=1, le=100),
    ] = 20,
    offset: Annotated[
        int,
        Query(ge=0),
    ] = 0,
):
    try:
        return (
            contract_analysis_runs
            .list_contract_analysis_runs(
                session=session,
                contract_id=contract_id,
                version_number=version_number,
                limit=limit,
                offset=offset,
            )
        )
    except Exception as error:  # noqa: BLE001
        raise_contract_analysis_service_error(
            error
        )


@router.get(
    (
        "/{contract_id}/versions/{version_number}"
        "/analyses/{analysis_id}"
    ),
    response_model=ContractAnalysisRunRead,
)
def get_contract_analysis(
    contract_id: int,
    version_number: Annotated[int, Path(gt=0)],
    analysis_id: Annotated[int, Path(gt=0)],
    session: DatabaseSession,
):
    try:
        return (
            contract_analysis_runs
            .get_contract_analysis_run(
                session=session,
                contract_id=contract_id,
                version_number=version_number,
                analysis_id=analysis_id,
            )
        )
    except Exception as error:  # noqa: BLE001
        raise_contract_analysis_service_error(
            error
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
    current_user: CurrentUser,
    session: DatabaseSession,
) -> FileResponse:
    try:
        generated_file = (
            contract_documents.generate_contract_docx(
                session=session,
                contract_id=contract_id,
                actor_user_id=current_user.id,
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
    current_user: CurrentUser,
    session: DatabaseSession,
) -> Contract:
    try:
        return service.update_contract(
            session=session,
            contract_id=contract_id,
            payload=payload,
            actor_user_id=current_user.id,
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
    current_user: CurrentUser,
    session: DatabaseSession,
) -> Contract:
    try:
        return service.change_contract_status(
            session=session,
            contract_id=contract_id,
            target_status=payload.status,
            actor_user_id=current_user.id,
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
    current_user: CurrentUser,
    session: DatabaseSession,
) -> Contract:
    try:
        return service.archive_contract(
            session=session,
            contract_id=contract_id,
            actor_user_id=current_user.id,
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
    current_user: CurrentUser,
    session: DatabaseSession,
) -> Contract:
    try:
        return service.restore_contract(
            session=session,
            contract_id=contract_id,
            actor_user_id=current_user.id,
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
