import logging
import os
from enum import StrEnum

from pydantic import BaseModel

logger = logging.getLogger(__name__)


class Env(StrEnum):
    PROD = "prod"
    DEV = "dev"


class LogLevel(StrEnum):
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"


class EnvironmentVariableManager(BaseModel):
    ENV: Env = Env(os.environ.get("ENV"))
    DB_HOST: str = os.environ.get("DB_HOST")  # type: ignore
    DB_USER: str = os.environ.get("DB_USER")  # type: ignore
    DB_NAME: str = os.environ.get("DB_NAME")  # type: ignore
    DB_PASSWORD: str = os.environ.get("DB_PASSWORD")  # type: ignore
    DB_PORT: int = int(os.environ.get("DB_PORT"))  # type: ignore
    REDIS_HOST: str = os.environ.get("REDIS_HOST")  # type: ignore
    REDIS_PORT: int = int(os.environ.get("REDIS_PORT"))  # type: ignore
    SECRET_KEY: str = os.environ.get("SECRET_KEY")  # type: ignore
    GOOGLE_CLIENT_ID: str = os.environ.get("GOOGLE_CLIENT_ID")  # type: ignore
    GOOGLE_PROJECT_ID: str = os.environ.get("GOOGLE_PROJECT_ID")  # type: ignore
    GOOGLE_CLIENT_SECRET: str = os.environ.get("GOOGLE_CLIENT_SECRET")  # type: ignore
    LOG_LEVEL: LogLevel = LogLevel(os.environ.get("LOG_LEVEL"))
    SQL_LOG: bool = bool(int(os.environ.get("SQL_LOG")))  # type: ignore


env = EnvironmentVariableManager()
