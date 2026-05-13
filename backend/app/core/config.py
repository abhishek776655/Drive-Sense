from functools import lru_cache
from datetime import timedelta
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_ignore_empty=True, extra="ignore")

    app_name: str = Field(default="DriveSense API", alias="APP_NAME")
    environment: Literal["local", "dev", "staging", "prod"] = Field(default="local", alias="ENVIRONMENT")
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")
    api_v1_prefix: str = Field(default="/api/v1", alias="API_V1_PREFIX")

    postgres_host: str = Field(default="db", alias="POSTGRES_HOST")
    postgres_port: int = Field(default=5432, alias="POSTGRES_PORT")
    postgres_db: str = Field(default="drivesense", alias="POSTGRES_DB")
    postgres_user: str = Field(default="drivesense", alias="POSTGRES_USER")
    postgres_password: str = Field(default="drivesense", alias="POSTGRES_PASSWORD")
    sqlalchemy_echo: bool = Field(default=False, alias="SQLALCHEMY_ECHO")
    sqlalchemy_pool_pre_ping: bool = Field(default=True, alias="SQLALCHEMY_POOL_PRE_PING")

    redis_url: str = Field(default="redis://redis:6379/0", alias="REDIS_URL")

    jwt_secret_key: str = Field(default="CHANGE_ME", alias="JWT_SECRET_KEY")
    jwt_algorithm: str = Field(default="HS256", alias="JWT_ALGORITHM")
    access_token_expire_days: int = Field(default=7, alias="ACCESS_TOKEN_EXPIRE_DAYS")

    @property
    def sqlalchemy_database_uri_async(self) -> str:
        return (
            f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def access_token_expires_in(self) -> timedelta:
        return timedelta(days=self.access_token_expire_days)


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
