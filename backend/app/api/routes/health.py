import psycopg
from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.core.config import get_settings


router = APIRouter(tags=["System"])


@router.get("/")
def root() -> dict[str, str]:
    settings = get_settings()

    return {
        "name": settings.app_name,
        "version": settings.app_version,
        "environment": settings.app_environment,
        "status": "development mode",
    }


@router.get("/health")
def health() -> JSONResponse:
    settings = get_settings()

    try:
        with psycopg.connect(
            settings.database_url,
            connect_timeout=3,
        ) as connection:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                result = cursor.fetchone()

        if result != (1,):
            raise RuntimeError("Unexpected database response")

        return JSONResponse(
            status_code=200,
            content={
                "status": "ok",
                "api": "available",
                "database": "available",
            },
        )

    except Exception as error:
        return JSONResponse(
            status_code=503,
            content={
                "status": "error",
                "api": "available",
                "database": "unavailable",
                "detail": str(error),
            },
        )