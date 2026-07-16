from fastapi import APIRouter
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import get_settings
from app.db.session import engine


router = APIRouter(tags=["System"])


@router.get("/")
def root() -> dict[str, str]:
    settings = get_settings()

    return {
        "name": settings.app_name,
        "version": settings.app_version,
        "environment": settings.app_environment,
        "status": "running",
    }


@router.get("/health")
def health() -> JSONResponse:
    try:
        with engine.connect() as connection:
            result = connection.execute(text("SELECT 1")).scalar_one()

        if result != 1:
            raise RuntimeError("Unexpected database response")

        return JSONResponse(
            status_code=200,
            content={
                "status": "ok",
                "api": "available",
                "database": "available",
            },
        )

    except (SQLAlchemyError, RuntimeError) as error:
        return JSONResponse(
            status_code=503,
            content={
                "status": "error",
                "api": "available",
                "database": "unavailable",
                "detail": str(error),
            },
        )