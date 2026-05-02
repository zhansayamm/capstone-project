from __future__ import annotations

import logging

from sqlmodel import Session, select
from sqlalchemy.orm import selectinload

from app.core.exceptions import ForbiddenException, NotFoundException
from app.models.booking import Booking
from app.models.booking_message import BookingMessage
from app.models.booking_participant import BookingParticipant
from app.models.user import User
from app.tasks.notification_tasks import create_notification_task


logger = logging.getLogger(__name__)


class BookingMessageService:
    @staticmethod
    def _assert_can_access(*, session: Session, user: User, booking: Booking) -> None:
        slot = booking.slot
        if not slot:
            raise NotFoundException("Slot not found")
        if booking.university_id != user.university_id or slot.university_id != user.university_id:
            raise ForbiddenException("You cannot access bookings from another university")

        is_owner = booking.student_id == user.id
        is_professor = slot.professor_id == user.id
        is_participant = session.exec(
            select(BookingParticipant).where(
                BookingParticipant.booking_id == booking.id,
                BookingParticipant.student_id == user.id,
            )
        ).first() is not None

        logger.info(
            "booking_chat_access user_id=%s booking_student_id=%s slot_professor_id=%s is_owner=%s is_professor=%s is_participant=%s",
            user.id,
            booking.student_id,
            slot.professor_id,
            is_owner,
            is_professor,
            is_participant,
        )

        if is_owner or is_professor or user.role == "admin" or is_participant:
            return

        raise ForbiddenException("Forbidden")

    @staticmethod
    def list_messages(*, session: Session, user: User, booking_id: int, limit: int = 50, offset: int = 0) -> list[dict]:
        booking = session.exec(
            select(Booking).where(Booking.id == booking_id).options(selectinload(Booking.slot))
        ).first()
        if not booking:
            raise NotFoundException("Booking not found")
        BookingMessageService._assert_can_access(session=session, user=user, booking=booking)

        rows = session.exec(
            select(BookingMessage)
            .where(BookingMessage.booking_id == booking_id)
            .order_by(BookingMessage.created_at)
            .offset(offset)
            .limit(limit)
        ).all()

        out: list[dict] = []
        for m in rows:
            sender = session.get(User, m.sender_id)
            out.append(
                {
                    "id": m.id,
                    "booking_id": m.booking_id,
                    "sender_id": m.sender_id,
                    "message": m.message,
                    "created_at": m.created_at,
                    "sender": sender,
                }
            )
        return out

    @staticmethod
    def create_message(*, session: Session, user: User, booking_id: int, message: str) -> dict:
        booking = session.exec(
            select(Booking).where(Booking.id == booking_id).options(selectinload(Booking.slot))
        ).first()
        if not booking:
            raise NotFoundException("Booking not found")
        BookingMessageService._assert_can_access(session=session, user=user, booking=booking)
        slot = booking.slot
        if not slot:
            raise NotFoundException("Slot not found")

        m = BookingMessage(
            booking_id=booking_id,
            sender_id=user.id,
            message=message,
        )
        session.add(m)
        session.commit()
        session.refresh(m)

        # Notify other side (owner/professor), excluding sender, without duplicates
        recipients: set[int] = set()
        if booking.student_id != user.id:
            recipients.add(int(booking.student_id))
        if slot.professor_id != user.id:
            recipients.add(int(slot.professor_id))

        notification_message = f"New message in booking: {slot.title}"
        for uid in recipients:
            recipient = session.get(User, uid)
            if not recipient:
                continue
            if recipient.university_id != user.university_id:
                continue
            create_notification_task.delay(uid, notification_message)

        return {
            "id": m.id,
            "booking_id": m.booking_id,
            "sender_id": m.sender_id,
            "message": m.message,
            "created_at": m.created_at,
            "sender": user,
        }

