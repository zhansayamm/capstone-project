from celery import Celery


celery = Celery(
    "booking_system",
    broker="redis://localhost:6379/0",
    backend="redis://localhost:6379/0",
    include=["app.tasks.email_tasks", "app.tasks.notification_tasks", "app.tasks.image_tasks"],
)

celery.autodiscover_tasks(["app.tasks"])

# Compatibility alias for existing imports/usages.
celery_app = celery

# Safety net: ensure modules are imported even if autodiscovery is constrained.
import app.tasks.image_tasks  # noqa: E402,F401
