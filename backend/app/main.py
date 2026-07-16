from fastapi import FastAPI

from app.api.routes.health import router as health_router
from app.core.config import get_settings
from app.api.routes.counterparties import router as counterparties_router


settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    debug=settings.debug,
)

app.include_router(health_router)
app.include_router(counterparties_router)