from functools import lru_cache

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "PromAI API"
    app_version: str = "0.1.0"
    app_environment: str = "development"
    debug: bool = False

    database_url: str
    storage_root: str = "/app/storage"

    auth_secret_key: SecretStr = Field(
        min_length=32,
    )
    auth_issuer: str = "promai-api"
    auth_access_token_minutes: int = Field(
        default=15,
        ge=1,
        le=1440,
    )
    auth_refresh_token_days: int = Field(
        default=7,
        ge=1,
        le=90,
    )

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
