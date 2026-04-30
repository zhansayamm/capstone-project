import time
from datetime import datetime, timezone

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.trustedhost import TrustedHostMiddleware
import logging
from sqlmodel import SQLModel
from app.db import engine

from app.models import *

from app.api import auth, slots, bookings, classrooms, reservations, admin, universities, calendar, notifications, images, users
from app.core.exceptions import AppException
from app.core.limiter import limiter


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("booking-system")

# Production safety: keep profiling disabled by default because it adds overhead.
# Enable temporarily for debugging specific endpoints.
ENABLE_PROFILING = False

app = FastAPI(
    title="Booking Time API",
    description="University booking system (office hours + classrooms)",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["*"],
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


@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    start_time = time.time()
    profiler = None

    # Latency thresholds (ms) for classification:
    # - FAST: <100ms
    # - MEDIUM: 100-499ms
    # - SLOW: >=500ms
    # These are meant to quickly surface slow endpoints without heavy tracing.
    if ENABLE_PROFILING:
        # Profiling adds overhead; only use it when debugging.
        # Turn ENABLE_PROFILING=True temporarily and restart the server.
        from pyinstrument import Profiler

        profiler = Profiler()
        profiler.start()

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
        if profiler is not None:
            profiler.stop()
            # Optional deep profiling output: printed to stdout only.
            print(profiler.output_text(unicode=True, color=True))

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

        # Detect slow endpoints:
        # - if request is slow (>500ms) log with WARNING
        # - if it is also a server error (>=500) log with ERROR
        if latency_level == "SLOW":
            payload["message"] = "Slow endpoint detected"
            logger.warning(payload)

        if status_code >= 500:
            logger.error(payload)
        elif latency_level != "SLOW":
            logger.info(payload)

    return response


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


@app.on_event("startup")
def on_startup():
    SQLModel.metadata.create_all(engine)

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
        "docs": "/docs"
    }


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/info")
def info():
    return {"app": "Booking System", "version": "1.0.0"}