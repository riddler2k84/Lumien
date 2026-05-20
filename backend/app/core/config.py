from pydantic_settings import BaseSettings
from typing import Literal


class Settings(BaseSettings):
    APP_MODE: Literal["production", "demo"] = "production"
    APP_NAME: str = "School Scheduler"
    SECRET_KEY: str = "change-me-to-a-random-secret-key-at-least-32-chars"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480

    DATABASE_URL: str = "postgresql://user:password@localhost:5432/school_scheduler"

    DEFAULT_CURRENCY: str = "SGD"
    CURRENCY_SYMBOL: str = "$"

    DEMO_RESET_CRON: str = "0 2 * * *"

    @property
    def is_demo(self) -> bool:
        return self.APP_MODE == "demo"

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
