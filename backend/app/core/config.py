import os
from typing import List

from dotenv import load_dotenv

load_dotenv()


def _env_name() -> str:
    return (os.getenv("ENVIRONMENT") or os.getenv("RAILWAY_ENVIRONMENT") or "development").lower()


def is_production() -> bool:
    return _env_name() in ("production", "prod")


def _running_on_railway() -> bool:
    return bool(os.getenv("RAILWAY_PROJECT_ID") or os.getenv("RAILWAY_ENVIRONMENT"))


def _normalize_postgres_url(url: str) -> str:
    """Normalize SQLAlchemy URL for synchronous psycopg2.

    Accepts postgres://, postgresql:// (Railway/Heroku), already-correct postgresql+psycopg2://.
    """
    if url.startswith("postgresql+psycopg2://"):
        return url
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+psycopg2://", 1)
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+psycopg2://", 1)
    return url


def get_database_url() -> str:
    raw = (os.getenv("DATABASE_URL") or "").strip()
    if raw:
        if raw.startswith("sqlite"):
            return raw
        return _normalize_postgres_url(raw)
    if _running_on_railway():
        raise RuntimeError(
            "DATABASE_URL is required on Railway. Add a PostgreSQL service and link DATABASE_URL.",
        )
    if is_production():
        raise RuntimeError(
            "DATABASE_URL is required in production. Add the PostgreSQL URL from Railway (Variables tab).",
        )
    return "sqlite:///./app.db"


def get_cors_origins() -> List[str]:
    """Parse ``CORS_ORIGINS`` (comma-separated). Strips whitespace and trailing slashes per origin."""
    default = (
        "http://localhost:5173,http://127.0.0.1:5173,"
        "https://your-frontend.vercel.app"
    )
    raw = (os.getenv("CORS_ORIGINS") or default).strip()
    return [
        o.strip().rstrip("/")
        for o in raw.split(",")
        if o.strip()
    ]


def get_cors_allow_origin_regex() -> str | None:
    """Optional regex so Vercel preview URLs (*.vercel.app) pass CORS without listing each branch.

    Starlette matches the full ``Origin`` header. Set ``CORS_VERCEL_REGEX=0`` to disable the
    built-in Vercel pattern, or set ``CORS_ORIGIN_REGEX`` to a custom pattern.
    """
    custom = (os.getenv("CORS_ORIGIN_REGEX") or "").strip()
    if custom:
        return custom
    if os.getenv("CORS_VERCEL_REGEX", "1").strip().lower() in ("0", "false", "no", "off"):
        return None
    # Production + preview deploys: https://<anything>.vercel.app
    return r"^https://[\w.-]+\.vercel\.app$"


def validate_cors_credentials_safe(origins: List[str]) -> None:
    """Starlette forbids wildcard origins when credentials are allowed; fail fast."""
    cleaned = [o for o in origins if o.strip()]
    if not cleaned:
        raise RuntimeError("CORS_ORIGINS must list at least one origin (comma-separated); empty is not allowed.")
    if any(o == "*" for o in cleaned):
        raise RuntimeError(
            'CORS_ORIGINS must not contain "*" while allow_credentials=True. '
            "List explicit HTTPS origins for your frontend (e.g. https://app.vercel.app).",
        )


class Settings:
    """Runtime settings (env-driven). Use get_database_url() for the effective SQL URL."""

    DATABASE_URL: str | None = os.getenv("DATABASE_URL")
    SECRET_KEY: str | None = os.getenv("SECRET_KEY")
    ALGORITHM: str = os.getenv("ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))

    EMAIL_HOST: str = os.getenv("EMAIL_HOST", "")
    EMAIL_PORT: int = int(os.getenv("EMAIL_PORT", "587"))
    EMAIL_USER: str = os.getenv("EMAIL_USER", "")
    EMAIL_PASSWORD: str = os.getenv("EMAIL_PASSWORD", "")

    # Broker for optional Celery workers (not required for API process only).
    REDIS_URL: str | None = os.getenv("REDIS_URL") or os.getenv("CELERY_BROKER_URL")

    SKIP_DB_CREATE_ALL: bool = os.getenv("SKIP_DB_CREATE_ALL", "").lower() in ("1", "true", "yes")


settings = Settings()


def validate_deploy_environment_strict() -> None:
    """Fail fast on hosted deploys when required variables are weak or tiers are undeclared."""
    if not (_running_on_railway() or is_production()):
        return
    raw_db = (os.getenv("DATABASE_URL") or "").strip()
    if not raw_db:
        raise RuntimeError("DATABASE_URL is required for this deployment; it is empty or unset.")
    # Railway often sets only RAILWAY_ENVIRONMENT — treat stray "development" as misconfiguration.
    if _running_on_railway() and _env_name() == "development":
        raise RuntimeError(
            "On Railway set ENVIRONMENT=production (and rely on DATABASE_URL / SECRET_KEY from variables). "
            'Both ENVIRONMENT and RAILWAY_ENVIRONMENT resolve to deployment tier "development", '
            "which is invalid for hosted production traffic.",
        )
    if not settings.SECRET_KEY or len(settings.SECRET_KEY) < 16:
        raise RuntimeError(
            "SECRET_KEY must be set to a long random value on Railway / in production "
            "(e.g. openssl rand -hex 32).",
        )
    if _env_name() not in ("production", "prod", "staging"):
        raise RuntimeError(
            f'Deploy ENVIRONMENT tier must be production, prod, or staging; got {_env_name()!r}. '
            'Set ENVIRONMENT=production.',
        )


def validate_production_secrets() -> None:
    """Backward-compatible alias: full deploy gates live in validate_deploy_environment_strict."""
    validate_deploy_environment_strict()
