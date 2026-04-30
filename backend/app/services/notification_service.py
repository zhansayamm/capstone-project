from __future__ import annotations

from datetime import datetime, timedelta, timezone

import logging
from sqlalchemy import or_
from sqlalchemy import update
from sqlmodel import Session, select

from app.core.exceptions import ForbiddenException, NotFoundException
from app.models.booking import Booking
from app.models.enums import BookingStatus
from app.models.notification import Notification
from app.models.reservation import Reservation
from app.models.slot import Slot
from app.models.user import User
from app.tasks.email_tasks import send_email_task
from app.tasks.notification_tasks import create_notification_task


logger = logging.getLogger(__name__)


class NotificationService:
    @staticmethod
    def _as_utc(dt: datetime) -> datetime:
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)

    @staticmethod
    def create_notification(
        session: Session,
        user: User,
        message: str,
        *,
        subject: str = "Notification",
    ) -> Notification:
        notification = Notification(
            user_id=user.id,
            message=message,
        )
        session.add(notification)
        session.commit()
        session.refresh(notification)

        return notification

    @staticmethod
    def booking_confirmed(user: User, slot: Slot) -> None:
        send_email_task.delay(
            user.email,
            "Booking Confirmed",
            f"You booked a slot at {slot.start_time}",
        )

    @staticmethod
    def booking_cancelled(user: User, slot: Slot) -> None:
        send_email_task.delay(
            user.email,
            "Booking Cancelled",
            f"Your booking at {slot.start_time} was cancelled",
        )

    @staticmethod
    def moved_from_queue(user: User, slot: Slot) -> None:
        send_email_task.delay(
            user.email,
            "You are now booked!",
            f"You got a slot at {slot.start_time}",
        )

    @staticmethod
    def reservation_confirmed(user: User, reservation: Reservation, classroom) -> None:
        send_email_task.delay(
            user.email,
            "Reservation Confirmed",
            f"Classroom {classroom.name} reserved at {reservation.start_time}",
        )

    @staticmethod
    def schedule_booking_reminder(user: User, slot: Slot) -> None:
        slot_start = NotificationService._as_utc(slot.start_time)
        delay_seconds = (slot_start - datetime.now(timezone.utc)).total_seconds() - 3600

        if delay_seconds > 0:
            reminder_message = f"Reminder: your event starts at {slot.start_time}"
            send_email_task.apply_async(
                args=[
                    user.email,
                    "Reminder",
                    f"Your booking starts at {slot.start_time}",
                ],
                countdown=delay_seconds,
            )
            create_notification_task.apply_async(
                args=[user.id, reminder_message],
                countdown=delay_seconds,
            )

    @staticmethod
    def schedule_reservation_reminder(user: User, reservation: Reservation, classroom) -> None:
        reservation_start = NotificationService._as_utc(reservation.start_time)
        delay_seconds = (reservation_start - datetime.now(timezone.utc)).total_seconds() - 3600

        if delay_seconds > 0:
            reminder_message = f"Reminder: your event starts at {reservation.start_time}"
            send_email_task.apply_async(
                args=[
                    user.email,
                    "Reminder",
                    f"Your reservation in {classroom.name} starts at {reservation.start_time}",
                ],
                countdown=delay_seconds,
            )
            create_notification_task.apply_async(
                args=[user.id, reminder_message],
                countdown=delay_seconds,
            )

    @staticmethod
    def get_user_notifications(session: Session, user: User) -> list[Notification]:
        return list(
            session.exec(
                select(Notification)
                .where(Notification.user_id == user.id)
                .order_by(Notification.created_at.desc())
            ).all()
        )

    @staticmethod
    def get_unread_notifications(session: Session, user: User) -> list[Notification]:
        return list(
            session.exec(
                select(Notification)
                .where(Notification.user_id == user.id, Notification.is_read == False)  # noqa: E712
                .order_by(Notification.created_at.desc())
            ).all()
        )

    @staticmethod
    def mark_as_read(session: Session, user: User, notification_id: int) -> Notification:
        notification = session.get(Notification, notification_id)
        if not notification:
            raise NotFoundException("Notification not found")
        if notification.user_id != user.id:
            raise ForbiddenException("You can only update your own notifications")
        notification.is_read = True
        session.add(notification)
        session.commit()
        session.refresh(notification)
        return notification

    @staticmethod
    def mark_all_as_read(session: Session, user: User) -> int:
        result = session.exec(
            update(Notification)
            .where(Notification.user_id == user.id, Notification.is_read == False)  # noqa: E712
            .values(is_read=True)
        )
        session.commit()
        # SQLAlchemy returns rowcount on the underlying result
        return int(getattr(result, "rowcount", 0) or 0)

    @staticmethod
    def send_booking_confirmed(session: Session, user: User, slot: Slot) -> Notification:
        NotificationService.booking_confirmed(user, slot)
        message = f"You booked a slot at {slot.start_time}"
        return NotificationService.create_notification(session, user, message, subject="Booking Confirmed")

    @staticmethod
    def send_booking_queued(session: Session, user: User, slot: Slot) -> Notification:
        message = f"You are added to queue for slot at {slot.start_time}"
        return NotificationService.create_notification(
            session,
            user,
            message,
            subject="Booking Queued",
        )

    @staticmethod
    def send_queue_promoted(session: Session, user: User, slot: Slot) -> Notification:
        NotificationService.moved_from_queue(user, slot)
        message = f"You were moved from queue to booked for {slot.start_time}"
        return NotificationService.create_notification(session, user, message, subject="You are now booked!")

    @staticmethod
    def send_reservation_created(
        session: Session,
        user: User,
        reservation: Reservation,
        *,
        classroom_name: str | None = None,
    ) -> Notification:
        class _Classroom:
            def __init__(self, name: str):
                self.name = name

        classroom_label = classroom_name or str(reservation.classroom_id)
        NotificationService.reservation_confirmed(user, reservation, _Classroom(classroom_label))
        message = f"Classroom {classroom_label} reserved at {reservation.start_time}"
        return NotificationService.create_notification(
            session,
            user,
            message,
            subject="Reservation Confirmed",
        )

    @staticmethod
    def send_booking_cancelled(session: Session, user: User, slot: Slot) -> Notification:
        NotificationService.booking_cancelled(user, slot)
        message = f"Your booking at {slot.start_time} was cancelled"
        return NotificationService.create_notification(session, user, message, subject="Booking Cancelled")

    @staticmethod
    def _reminder_message_for_time(start_time: datetime) -> str:
        return f"Reminder: your event starts at {start_time}"

    @staticmethod
    def _reminder_exists(session: Session, user_id: int, message: str) -> bool:
        existing = session.exec(
            select(Notification).where(
                Notification.user_id == user_id,
                Notification.message == message,
            )
        ).first()
        return existing is not None

    @staticmethod
    def check_upcoming_events(session: Session) -> int:
        now = datetime.now(timezone.utc)
        window_end = now + timedelta(hours=1)
        created = 0

        booking_rows = session.exec(
            select(Booking, Slot)
            .join(Slot)
            .where(
                Slot.start_time > now,
                Slot.start_time <= window_end,
                or_(
                    Booking.status == BookingStatus.booked,
                    Booking.status == BookingStatus.queued,
                ),
            )
        ).all()

        for booking, slot in booking_rows:
            msg = NotificationService._reminder_message_for_time(slot.start_time)
            if NotificationService._reminder_exists(session, booking.student_id, msg):
                continue
            reminder_user = session.get(User, booking.student_id)
            if not reminder_user:
                continue
            NotificationService.create_notification(
                session,
                reminder_user,
                msg,
                subject="Reminder",
            )
            created += 1

        reservations = session.exec(
            select(Reservation).where(
                Reservation.start_time > now,
                Reservation.start_time <= window_end,
            )
        ).all()

        for reservation in reservations:
            msg = NotificationService._reminder_message_for_time(reservation.start_time)
            if NotificationService._reminder_exists(session, reservation.user_id, msg):
                continue
            reminder_user = session.get(User, reservation.user_id)
            if not reminder_user:
                continue
            NotificationService.create_notification(
                session,
                reminder_user,
                msg,
                subject="Reminder",
            )
            created += 1

        return created
