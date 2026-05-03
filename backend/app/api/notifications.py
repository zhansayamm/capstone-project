from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.core.deps import get_current_user
from app.db import get_session
from app.models.user import User
from app.schemas.notification import NotificationRead
from app.services.notification_service import NotificationService
from app.utils.datetime_utils import to_local

notification_router = APIRouter(redirect_slashes=False)


@notification_router.get("/me", response_model=list[NotificationRead])
def get_my_notifications(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    items = NotificationService.get_user_notifications(session, current_user)
    return [
        {
            "id": n.id,
            "message": n.message,
            "created_at": to_local(n.created_at),
            "is_read": n.is_read,
        }
        for n in items
    ]


@notification_router.get("/unread", response_model=list[NotificationRead])
def get_unread_notifications(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    items = NotificationService.get_unread_notifications(session, current_user)
    return [
        {
            "id": n.id,
            "message": n.message,
            "created_at": to_local(n.created_at),
            "is_read": n.is_read,
        }
        for n in items
    ]


@notification_router.patch("/{notification_id}/read", response_model=NotificationRead)
def mark_notification_read(
    notification_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    n = NotificationService.mark_as_read(session, current_user, notification_id)
    return {
        "id": n.id,
        "message": n.message,
        "created_at": to_local(n.created_at),
        "is_read": n.is_read,
    }


@notification_router.patch("/me/read-all")
def mark_all_read(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    updated = NotificationService.mark_all_as_read(session, current_user)
    return {"updated": updated}
