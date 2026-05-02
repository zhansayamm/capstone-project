import os

from celery import Celery

_redis_url = (
    os.getenv("REDIS_URL")
    or os.getenv("CELERY_BROKER_URL")
    or "redis://localhost:6379/0"
)
_result_backend = os.getenv("CELERY_RESULT_BACKEND") or _redis_url

celery = Celery(
    "booking_system",
    broker=_redis_url,
    backend=_result_backend,
    include=["app.tasks.email_tasks", "app.tasks.notification_tasks", "app.tasks.image_tasks"],
)

celery.autodiscover_tasks(["app.tasks"])

# Compatibility alias for existing imports/usages.
celery_app = celery

# Safety net: ensure modules are imported even if autodiscovery is constrained.
import app.tasks.image_tasks  # noqa: E402,F401
