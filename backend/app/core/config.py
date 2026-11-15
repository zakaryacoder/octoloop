import re
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict

DEFAULT_SECRET = "change-me-in-production-use-a-long-random-string"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    SECRET_KEY: str = DEFAULT_SECRET
    ALGORITHM: str = "HS256"
    # V2: short-lived access token (15 min). Refresh token handles session longevity.
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    ENV: str = "development"  # development | production
    HTTPS: bool = False  # enables HSTS header when true

    # Default SQLite for portable demo; override with postgresql+psycopg2://... in production.
    DATABASE_URL: str = "sqlite:///./database/octoloop.db"

    # CORS: explicit origins. Wildcard ONLY when ALLOW_CORS_WILDCARD=true (dev convenience).
    CORS_ORIGINS: str = "http://localhost:3000"
    ALLOW_CORS_WILDCARD: bool = False

    # Cookie+CSRF auth mode is documented but NOT default; SPA uses Bearer + refresh.
    USE_COOKIE_AUTH: bool = False

    # Scheduler (APScheduler BackgroundScheduler) — opt-in. Else external cron can call the hook.
    ENABLE_SCHEDULER: bool = False

    # Notification providers. "none" => QUEUED status + delivery log (never fake SENT).
    NOTIFICATION_EMAIL_PROVIDER: str = "none"  # none | smtp
    NOTIFICATION_SMS_PROVIDER: str = "none"    # none | twilio
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_FROM_NUMBER: str = ""

    # Optional LLM for AI operational intelligence. none => deterministic fallback always.
    LLM_PROVIDER: str = "none"  # none | openai | anthropic
    LLM_API_KEY: str = ""
    LLM_MODEL: str = "gpt-4o-mini"
    LLM_TIMEOUT_SECONDS: int = 10

    # Login security
    MAX_LOGIN_FAILS: int = 5
    LOCKOUT_MINUTES: int = 15
    LOGIN_RATE_LIMIT_PER_MINUTE: int = 20

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.ENV.strip().lower() == "production"

    @property
    def secret_is_weak(self) -> bool:
        return (not self.SECRET_KEY) or len(self.SECRET_KEY) < 32 or self.SECRET_KEY == DEFAULT_SECRET


_DATABASE_URL_RE = re.compile(r"^(sqlite|postgresql\+psycopg2|postgresql|mysql\+pymysql)://")


def validate_database_url(url: str) -> None:
    """Fail fast with a clear message if DATABASE_URL is malformed."""
    if not url or not _DATABASE_URL_RE.match(url):
        raise RuntimeError(
            f"DATABASE_URL is malformed or uses an unsupported driver: {url!r}. "
            "Expected sqlite:///... or postgresql+psycopg2://user:pass@host/db."
        )


settings = Settings()
