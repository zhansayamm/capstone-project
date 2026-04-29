from celery.utils.log import get_task_logger

from app.core.celery_app import celery
from app.core.email import send_email


logger = get_task_logger(__name__)


@celery.task(name="app.tasks.email_tasks.send_email_task")
def send_email_task(to: str, subject: str, body: str) -> None:
    logger.info("Email task executed: to=%s subject=%s", to, subject)
    send_email(to, subject, body)

