from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "Frontier International"
    APP_SHORT_NAME: str = "Lúmien"
    SECRET_KEY: str = "change-me-to-a-random-secret-key-at-least-32-chars"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480

    PRODUCTION_DATABASE_URL: str = "sqlite:///./production.db"
    DEMO_DATABASE_URL: str = "sqlite:///./demo.db"

    DEFAULT_CURRENCY: str = "MYR"
    CURRENCY_SYMBOL: str = "RM"

    SCHOOL_TYPE: str = "Private School"
    SCHOOL_COUNTRY: str = "Malaysia"

    DEMO_RESET_CRON: str = "0 2 * * *"

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
