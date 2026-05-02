"""Runtime checks invoked when the FastAPI app starts."""

from __future__ import annotations

import logging

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

logger = logging.getLogger("booking-system.startup")


def probe_database(engine: Engine) -> None:
    """Verify DATABASE_URL resolves to a live connection (PostgreSQL/SQLite)."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception as exc:
        logger.exception(
            "Database connection failed. Check DATABASE_URL connectivity (driver: %s).",
            getattr(engine.url, "drivername", "unknown"),
        )
        raise RuntimeError(
            "Could not connect to the database. "
            "Confirm DATABASE_URL (postgres:// / postgresql:// / postgresql+psycopg2:// supported), "
            "network routing, firewall, and SSL query params from your host (e.g. Railway PostgreSQL)."
        ) from exc
    try:
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        logger.info(
            "Database reachable; driver=%s; table_count=%s",
            getattr(engine.url, "drivername", "unknown"),
            len(tables),
        )
    except Exception as introspect_exc:
        logger.warning(
            "Database connection OK but schema introspection failed (non-fatal): %s",
            introspect_exc,
        )


def log_schema_bootstrap(skip_create_all: bool) -> None:
    if skip_create_all:
        logger.info("Schema bootstrap: skipped (SKIP_DB_CREATE_ALL)")
    else:
        logger.info("Schema bootstrap: SQLModel.metadata.create_all completed")
