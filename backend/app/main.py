from fastapi import FastAPI

from app.api.routes.health import router as health_router
from app.core.config import get_settings
from app.api.routes.counterparties import router as counterparties_router
from app.api.routes.contracts import router as contracts_router
from fastapi.middleware.cors import CORSMiddleware

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    debug=settings.debug,
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
)

app.include_router(health_router)
app.include_router(counterparties_router)
app.include_router(contracts_router)