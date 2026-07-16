import os

import psycopg
from fastapi import FastAPI
from fastapi.responses import JSONResponse


app = FastAPI(
    title="PromAI API",
    version="0.1.0",
)


def get_database_url() -> str:
    database_url = os.getenv("DATABASE_URL")

    if not database_url:
        raise RuntimeError("DATABASE_URL is not configured")

    return database_url


@app.get("/")
def root() -> dict[str, str]:
    return {
        "name": "PromAI API",
        "status": "running",
    }


@app.get("/health")
def health() -> JSONResponse:
    try:
        with psycopg.connect(
            get_database_url(),
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