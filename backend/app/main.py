import os
import time
from datetime import datetime, timezone

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import logging
from slowapi.errors import RateLimitExceeded
from sqlmodel import SQLModel
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.trustedhost import TrustedHostMiddleware

from app.api import (
    admin,
    auth,
    bookings,
    calendar,
    classrooms,
    images,
    notifications,
    reservations,
    slots,
    universities,
    users,
)
from app.core.config import (
    get_cors_allow_origin_regex,
    get_cors_origins,
    is_production,
    settings,
    validate_cors_credentials_safe,
    validate_production_secrets,
)
from app.core.security import PASSWORD_HASH_BACKEND
from app.core.startup_checks import log_schema_bootstrap, probe_database
from app.core.exceptions import AppException
from app.core.limiter import limiter
from app.db import engine

from app.models import *


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("booking-system")

app = FastAPI(
    title="Booking Time API",
    description="University booking system (office hours + classrooms)",
    version="1.0.0",
    redirect_slashes=False,
)

_cors_origins = get_cors_origins()
_cors_origin_regex = get_cors_allow_origin_regex()
validate_cors_credentials_safe(_cors_origins)

# Middleware runs in reverse registration order: last added = outermost = runs first.
# CORSMiddleware must be outer so OPTIONS preflight is answered before TrustedHost / HTTP middleware
# and never hits route dependencies (JWT is only on routes, not global — preflight still must not
# depend on inner layers rejecting OPTIONS).

@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    start_time = time.time()

    client_host = getattr(request.client, "host", None) if request.client else None
    client_port = getattr(request.client, "port", None) if request.client else None
    client = (
        f"{client_host}:{client_port}"
        if client_host is not None and client_port is not None
        else (client_host or "unknown")
    )

    try:
        response = await call_next(request)
        status_code = response.status_code
    except Exception:
        response = None
        status_code = 500
        raise
    finally:
        process_time_ms = int((time.time() - start_time) * 1000)
        if process_time_ms < 100:
            latency_level = "FAST"
        elif process_time_ms < 500:
            latency_level = "MEDIUM"
        else:
            latency_level = "SLOW"

        payload = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "service": "booking-system",
            "endpoint": request.url.path,
            "method": request.method,
            "status": status_code,
            "process_time_ms": process_time_ms,
            "latency_level": latency_level,
            "client": client,
        }

        if latency_level == "SLOW":
            payload["message"] = "Slow endpoint detected"
            logger.warning(payload)

        if status_code >= 500:
            logger.error(payload)
        elif latency_level != "SLOW":
            logger.info(payload)

    return response
    
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["*"],
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_origin_regex=_cors_origin_regex,
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)



app.state.limiter = limiter


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={
            "error": "Too Many Requests",
            "message": "Rate limit exceeded. Try again later.",
        },
    )

@app.exception_handler(AppException)
def app_exception_handler(request: Request, exc: AppException):
    logger.warning("%s: %s", exc.error, exc.message)
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.error, "message": exc.message},
    )


@app.exception_handler(StarletteHTTPException)
def http_exception_handler(request: Request, exc: StarletteHTTPException):
    error = "HTTPException"
    message = exc.detail if isinstance(exc.detail, str) else str(exc.detail)
    logger.warning("%s: %s", error, message)
    return JSONResponse(status_code=exc.status_code, content={"error": error, "message": message})


@app.exception_handler(RequestValidationError)
def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.warning("ValidationError: %s", exc.errors())
    return JSONResponse(
        status_code=422,
        content={"error": "ValidationError", "message": exc.errors()},
    )


@app.exception_handler(Exception)
def generic_exception_handler(request: Request, exc: Exception):
    """Avoid returning raw tracebacks over HTTP."""
    logger.exception("Unhandled exception: %s %s", request.method, request.url.path)
    payload: dict[str, object] = {
        "error": "InternalServerError",
        "message": "An unexpected error occurred.",
    }
    if (
        os.getenv("SHOW_ERROR_DETAILS", "").strip().lower() in ("1", "true", "yes")
        and not is_production()
    ):
        payload["detail"] = str(exc)
    return JSONResponse(status_code=500, content=payload)


@app.on_event("startup")
def on_startup():
    logger.info("password_hash_backend=%s", PASSWORD_HASH_BACKEND)
    validate_production_secrets()
    probe_database(engine)
    if settings.SKIP_DB_CREATE_ALL:
        log_schema_bootstrap(True)
        return
    try:
        SQLModel.metadata.create_all(engine)
        log_schema_bootstrap(False)
    except Exception as exc:
        logger.exception("SQLModel.metadata.create_all failed")
        raise RuntimeError(
            "Database schema bootstrap failed during create_all. "
            "Check model definitions versus existing DB migrations or set SKIP_DB_CREATE_ALL if schemas are migrated elsewhere."
        ) from exc


app.include_router(auth.router, prefix="/auth", tags=["Auth"])
app.include_router(slots.router, prefix="/slots", tags=["Slots"])
app.include_router(bookings.router, prefix="/bookings", tags=["Bookings"])
app.include_router(classrooms.router, prefix="/classrooms", tags=["Classrooms"])
app.include_router(reservations.router, prefix="/reservations", tags=["Reservations"])
app.include_router(universities.router, prefix="/universities", tags=["Universities"])
app.include_router(admin.router, prefix="/admin", tags=["Admin"])
app.include_router(calendar.calendar_router, prefix="/calendar", tags=["Calendar"])
app.include_router(
    notifications.notification_router,
    prefix="/notifications",
    tags=["Notifications"],
)

app.include_router(images.router, prefix="/images", tags=["Images"])
app.include_router(users.router, prefix="/users", tags=["Users"])


@app.get("/")
def root():
    return {
        "message": "Booking Time API is running",
        "docs": "/docs",
    }


@app.get("/health")
def health():
    return {"status": "ok"}
