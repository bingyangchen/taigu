import logging
import os

logger = logging.getLogger(__name__)


class EnvironmentVariableManager:
    def __init__(self) -> None:
        self.ENV = os.environ.get("ENV")
        self.DB_HOST = os.environ.get("DB_HOST")
        self.DB_USER = os.environ.get("DB_USER")
        self.DB_NAME = os.environ.get("DB_NAME")
        self.DB_PASSWORD = os.environ.get("DB_PASSWORD")
        self.DB_PORT = os.environ.get("DB_PORT")
        self.REDIS_HOST = os.environ.get("REDIS_HOST")
        self.REDIS_PORT = os.environ.get("REDIS_PORT")
        self.SECRET_KEY = os.environ.get("SECRET_KEY")
        self.__validate_env_vars()

    def __validate_env_vars(self) -> None:
        missed_vars = []
        for var_name, value in vars(self).items():
            if value is None:
                missed_vars.append(var_name)
        for var_name in missed_vars:
            logger.error(f"Environment variable {var_name} is not set.")
        if len(missed_vars) > 0:
            raise RuntimeError("Some environment variables are not set.")


env = EnvironmentVariableManager()
