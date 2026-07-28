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
from app.api.dependencies.auth import (
    get_current_active_user,
)
from app.models.technical_specification import (
    TechnicalSpecification,
    TechnicalSpecificationStatus,
)
from app.schemas.technical_specification import (
    TechnicalSpecificationCreate,
    TechnicalSpecificationRead,
    TechnicalSpecificationUpdate,
)
from app.schemas.pagination import Page
from app.services import technical_specifications as service


router = APIRouter(
    prefix="/technical-specifications",
    tags=["Technical specifications"],
    dependencies=[
        Depends(get_current_active_user),
    ],
)

DatabaseSession = Annotated[
    Session,
    Depends(get_db_session),
]


def raise_service_error(error: Exception) -> None:
    if isinstance(
        error,
        service.TechnicalSpecificationNotFoundError,
    ):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Техническое задание не найдено",
        )

    if isinstance(
        error,
        service.TechnicalSpecificationCounterpartyNotFoundError,
    ):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Контрагент не найден",
        )

    if isinstance(
        error,
        service.ArchivedTechnicalSpecificationCounterpartyError,
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Нельзя использовать архивного "
                "контрагента"
            ),
        )

    if isinstance(
        error,
        service.TechnicalSpecificationContractNotFoundError,
    ):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Договор не найден",
        )

    if isinstance(
        error,
        service.TechnicalSpecificationContractMismatchError,
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Договор относится к другому "
                "контрагенту"
            ),
        )

    if isinstance(
        error,
        service.ArchivedTechnicalSpecificationContractError,
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Нельзя использовать архивный договор",
        )

    if isinstance(
        error,
        service.TechnicalSpecificationTemplateNotFoundError,
    ):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Шаблон документа не найден",
        )

    if isinstance(
        error,
        service.InvalidTechnicalSpecificationTemplateTypeError,
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Выбранный шаблон не предназначен "
                "для технических заданий"
            ),
        )

    if isinstance(
        error,
        service.InactiveTechnicalSpecificationTemplateError,
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
        service.EmptyTechnicalSpecificationUpdateError,
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Не передано ни одного поля для изменения",
        )

    if isinstance(
        error,
        service.ArchivedTechnicalSpecificationModificationError,
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Архивное техническое задание "
                "сначала необходимо восстановить"
            ),
        )

    if isinstance(
        error,
        service.TechnicalSpecificationAlreadyArchivedError,
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Техническое задание уже находится "
                "в архиве"
            ),
        )

    if isinstance(
        error,
        service.TechnicalSpecificationNotArchivedError,
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Техническое задание не находится "
                "в архиве"
            ),
        )

    if isinstance(
        error,
        service.InvalidTechnicalSpecificationDatesError,
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "Дата окончания работ не может быть "
                "раньше даты начала"
            ),
        )

    if isinstance(
        error,
        service.ArchivedTechnicalSpecificationGenerationError,
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Архивное техническое задание "
                "сначала необходимо восстановить"
            ),
        )

    if isinstance(
        error,
        service.TechnicalSpecificationTemplateFileNotFoundError,
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Файл шаблона отсутствует в хранилище"
            ),
        )

    if isinstance(
        error,
        service.MissingTechnicalSpecificationTemplateVariablesError,
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
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
        service.InvalidTechnicalSpecificationDocxTemplateError,
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "Не удалось обработать DOCX-шаблон"
            ),
        )

    if isinstance(
        error,
        service.GeneratedTechnicalSpecificationFileNotFoundError,
    ):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                "Сгенерированный DOCX-файл не найден"
            ),
        )

    if isinstance(error, ValueError):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        )

    raise error


def create_docx_file_response(
    generated_file: (
        service.GeneratedTechnicalSpecificationFile
    ),
) -> FileResponse:
    return FileResponse(
        path=generated_file.path,
        media_type=service.DOCX_MEDIA_TYPE,
        filename=generated_file.file_name,
    )


@router.post(
    "",
    response_model=TechnicalSpecificationRead,
    status_code=status.HTTP_201_CREATED,
)
def create_technical_specification(
    payload: TechnicalSpecificationCreate,
    session: DatabaseSession,
) -> TechnicalSpecification:
    try:
        return service.create_technical_specification(
            session=session,
            payload=payload,
        )
    except Exception as error:
        raise_service_error(error)


@router.get(
    "",
    response_model=Page[TechnicalSpecificationRead],
)
def list_technical_specifications(
    session: DatabaseSession,
    counterparty_id: Annotated[
        int | None,
        Query(gt=0),
    ] = None,
    contract_id: Annotated[
        int | None,
        Query(gt=0),
    ] = None,
    template_id: Annotated[
        int | None,
        Query(gt=0),
    ] = None,
    technical_specification_status: (
        TechnicalSpecificationStatus | None
    ) = None,
    search: Annotated[
        str | None,
        Query(
            min_length=1,
            max_length=500,
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
) -> Page[TechnicalSpecificationRead]:
    result = service.list_technical_specifications(
        session=session,
        counterparty_id=counterparty_id,
        contract_id=contract_id,
        template_id=template_id,
        technical_specification_status=(
            technical_specification_status
        ),
        search=search,
        include_archived=include_archived,
        limit=limit,
        offset=offset,
    )
    return Page[TechnicalSpecificationRead](
        items=result.items,
        total=result.total,
        limit=result.limit,
        offset=result.offset,
    )


@router.get(
    "/{technical_specification_id}",
    response_model=TechnicalSpecificationRead,
)
def get_technical_specification(
    technical_specification_id: int,
    session: DatabaseSession,
) -> TechnicalSpecification:
    try:
        return service.get_technical_specification_by_id(
            session=session,
            technical_specification_id=(
                technical_specification_id
            ),
        )
    except Exception as error:
        raise_service_error(error)


@router.patch(
    "/{technical_specification_id}",
    response_model=TechnicalSpecificationRead,
)
def update_technical_specification(
    technical_specification_id: int,
    payload: TechnicalSpecificationUpdate,
    session: DatabaseSession,
) -> TechnicalSpecification:
    try:
        return service.update_technical_specification(
            session=session,
            technical_specification_id=(
                technical_specification_id
            ),
            payload=payload,
        )
    except Exception as error:
        raise_service_error(error)


@router.post(
    "/{technical_specification_id}/generate",
    response_class=FileResponse,
)
def generate_technical_specification_docx(
    technical_specification_id: int,
    session: DatabaseSession,
) -> FileResponse:
    try:
        generated_file = (
            service.generate_technical_specification_docx(
                session=session,
                technical_specification_id=(
                    technical_specification_id
                ),
            )
        )
    except Exception as error:
        raise_service_error(error)

    return create_docx_file_response(
        generated_file
    )


@router.get(
    "/{technical_specification_id}/download",
    response_class=FileResponse,
)
def download_technical_specification_docx(
    technical_specification_id: int,
    session: DatabaseSession,
) -> FileResponse:
    try:
        generated_file = (
            service.get_generated_technical_specification_docx(
                session=session,
                technical_specification_id=(
                    technical_specification_id
                ),
            )
        )
    except Exception as error:
        raise_service_error(error)

    return create_docx_file_response(
        generated_file
    )


@router.post(
    "/{technical_specification_id}/archive",
    response_model=TechnicalSpecificationRead,
)
def archive_technical_specification(
    technical_specification_id: int,
    session: DatabaseSession,
) -> TechnicalSpecification:
    try:
        return service.archive_technical_specification(
            session=session,
            technical_specification_id=(
                technical_specification_id
            ),
        )
    except Exception as error:
        raise_service_error(error)


@router.post(
    "/{technical_specification_id}/restore",
    response_model=TechnicalSpecificationRead,
)
def restore_technical_specification(
    technical_specification_id: int,
    session: DatabaseSession,
) -> TechnicalSpecification:
    try:
        return service.restore_technical_specification(
            session=session,
            technical_specification_id=(
                technical_specification_id
            ),
        )
    except Exception as error:
        raise_service_error(error)
