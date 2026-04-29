from sqlmodel import Session

from app.core.celery_app import celery
from app.db import engine
from app.models.user import User


@celery.task(name="app.tasks.notification_tasks.create_notification_task")
def create_notification_task(user_id: int, message: str) -> None:
    with Session(engine) as session:
        user = session.get(User, user_id)
        if not user:
            return
        # Local import avoids import cycles with services -> tasks dependencies.
        from app.services.notification_service import NotificationService

        NotificationService.create_notification(session, user, message)

