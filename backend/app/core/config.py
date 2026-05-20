from pydantic_settings import BaseSettings
from typing import Literal


class Settings(BaseSettings):
    APP_MODE: Literal["production", "demo"] = "production"
    APP_NAME: str = "Frontier International"
    APP_SHORT_NAME: str = "Lúmien"
    SECRET_KEY: str = "change-me-to-a-random-secret-key-at-least-32-chars"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480

    DATABASE_URL: str = "postgresql://user:password@localhost:5432/school_scheduler"

    DEFAULT_CURRENCY: str = "MYR"
    CURRENCY_SYMBOL: str = "RM"

    SCHOOL_TYPE: str = "Private School"
    SCHOOL_COUNTRY: str = "Malaysia"

    DEMO_RESET_CRON: str = "0 2 * * *"

    @property
    def is_demo(self) -> bool:
        return self.APP_MODE == "demo"

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
