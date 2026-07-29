import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.contracts import router as contracts_router
from app.api.routes.auth import router as auth_router
from app.api.routes.counterparties import router as counterparties_router
from app.api.routes.document_templates import (
    router as document_templates_router,
)
from app.api.routes.health import router as health_router
from app.api.routes.organization_profile import (
    router as organization_profile_router,
)
from app.core.config import get_settings
from app.api.routes.users import router as users_router

from app.api.routes.technical_specifications import (
    router as technical_specifications_router,
)
from app.services import contract_analysis_jobs


settings = get_settings()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI):
    interrupted_count = (
        contract_analysis_jobs
        .fail_interrupted_analysis_jobs()
    )

    if interrupted_count:
        logger.warning(
            "Marked %s interrupted contract analyses as failed",
            interrupted_count,
        )

    yield


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    debug=settings.debug,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)

app.include_router(health_router)
app.include_router(auth_router)
app.include_router(users_router)
app.include_router(counterparties_router)
app.include_router(contracts_router)
app.include_router(organization_profile_router)
app.include_router(document_templates_router)
app.include_router(technical_specifications_router)
