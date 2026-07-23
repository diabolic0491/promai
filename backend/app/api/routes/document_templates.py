from typing import Annotated

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from sqlalchemy.orm import Session

from app.db.session import get_db_session
from app.api.dependencies.auth import (
    AdminUser,
    get_current_active_user,
)
from app.models.document_template import (
    DocumentTemplate,
    DocumentTemplateType,
)
from app.schemas.document_template import (
    DocumentTemplateRead,
    DocumentTemplateUpdate,
)
from app.services import document_templates as service


router = APIRouter(
    prefix="/document-templates",
    tags=["Document templates"],
    dependencies=[
        Depends(get_current_active_user),
    ],
)

DatabaseSession = Annotated[
    Session,
    Depends(get_db_session),
]


@router.post(
    "",
    response_model=DocumentTemplateRead,
    status_code=status.HTTP_201_CREATED,
)
def create_document_template(
    _: AdminUser,
    session: DatabaseSession,
    name: Annotated[
        str,
        Form(
            min_length=1,
            max_length=255,
        ),
    ],
    template_type: Annotated[
        DocumentTemplateType,
        Form(),
    ],
    required_variables: Annotated[
        str,
        Form(),
    ],
    file: Annotated[
        UploadFile,
        File(),
    ],
    description: Annotated[
        str | None,
        Form(),
    ] = None,
) -> DocumentTemplate:
    try:
        return service.create_document_template(
            session=session,
            name=name,
            template_type=template_type,
            description=description,
            required_variables_raw=required_variables,
            upload=file,
        )
    except service.InvalidRequiredVariablesError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "required_variables должен быть "
                "JSON-массивом непустых строк"
            ),
        )
    except service.InvalidDocumentTemplateFileError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Необходимо загрузить корректный DOCX-файл",
        )
    except service.DocumentTemplateFileTooLargeError:
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail="Размер шаблона превышает 10 МБ",
        )
    finally:
        file.file.close()


@router.get(
    "",
    response_model=list[DocumentTemplateRead],
)
def list_document_templates(
    session: DatabaseSession,
    template_type: DocumentTemplateType | None = None,
    include_archived: bool = False,
    limit: Annotated[
        int,
        Query(ge=1, le=100),
    ] = 20,
    offset: Annotated[
        int,
        Query(ge=0),
    ] = 0,
) -> list[DocumentTemplate]:
    return service.list_document_templates(
        session=session,
        template_type=template_type,
        include_archived=include_archived,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/{template_id}",
    response_model=DocumentTemplateRead,
)
def get_document_template(
    template_id: int,
    session: DatabaseSession,
) -> DocumentTemplate:
    try:
        return service.get_document_template_by_id(
            session=session,
            template_id=template_id,
        )
    except service.DocumentTemplateNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Шаблон документа не найден",
        )


@router.patch(
    "/{template_id}",
    response_model=DocumentTemplateRead,
)
def update_document_template(
    template_id: int,
    payload: DocumentTemplateUpdate,
    _: AdminUser,
    session: DatabaseSession,
) -> DocumentTemplate:
    try:
        return service.update_document_template(
            session=session,
            template_id=template_id,
            payload=payload,
        )
    except service.DocumentTemplateNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Шаблон документа не найден",
        )
    except service.DocumentTemplateAlreadyArchivedError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Архивный шаблон сначала "
                "необходимо восстановить"
            ),
        )
    except service.EmptyDocumentTemplateUpdateError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Не передано ни одного поля для изменения",
        )


@router.post(
    "/{template_id}/archive",
    response_model=DocumentTemplateRead,
)
def archive_document_template(
    template_id: int,
    _: AdminUser,
    session: DatabaseSession,
) -> DocumentTemplate:
    try:
        return service.archive_document_template(
            session=session,
            template_id=template_id,
        )
    except service.DocumentTemplateNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Шаблон документа не найден",
        )
    except service.DocumentTemplateAlreadyArchivedError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Шаблон уже находится в архиве",
        )


@router.post(
    "/{template_id}/restore",
    response_model=DocumentTemplateRead,
)
def restore_document_template(
    template_id: int,
    _: AdminUser,
    session: DatabaseSession,
) -> DocumentTemplate:
    try:
        return service.restore_document_template(
            session=session,
            template_id=template_id,
        )
    except service.DocumentTemplateNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Шаблон документа не найден",
        )
    except service.DocumentTemplateAlreadyActiveError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Шаблон не находится в архиве",
        )
