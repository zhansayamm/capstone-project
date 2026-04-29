from app.core.exceptions import ConflictException, ForbiddenException, NotFoundException
from sqlmodel import Session, select
from datetime import datetime
from sqlalchemy import func
import logging

from app.models.booking import Booking
from app.models.enums import BookingStatus
from app.models.slot import Slot
from app.models.user import User
from app.services.notification_service import NotificationService
from app.utils.datetime_utils import ensure_utc, utc_now


logger = logging.getLogger(__name__)


class BookingService:
    MAX_QUEUE_SIZE = 5

    @staticmethod
    def _queue_position(*, session: Session, booking: Booking) -> int:
        # Position among queued bookings for same slot ordered by created_at (1-based).
        position = session.exec(
            select(func.count())
            .select_from(Booking)
            .where(
                Booking.slot_id == booking.slot_id,
                Booking.status == BookingStatus.queued,
                Booking.created_at <= booking.created_at,
            )
        ).one()
        return int(position)

    @staticmethod
    def _to_read(*, session: Session, booking: Booking, slot: Slot) -> dict:
        queue_position = None
        if booking.status == BookingStatus.queued:
            queue_position = BookingService._queue_position(session=session, booking=booking)
        return {
            "id": booking.id,
            "student_id": booking.student_id,
            "slot_id": booking.slot_id,
            "university_id": booking.university_id,
            "status": booking.status,
            "created_at": booking.created_at,
            "slot": {
                "professor_id": slot.professor_id,
                "university_id": slot.university_id,
                "start_time": slot.start_time,
                "end_time": slot.end_time,
            },
            "queue_position": queue_position,
        }

    @staticmethod
    def create_booking(*, session: Session, student: User, slot_id: int) -> dict:
        slot = session.get(Slot, slot_id)
        if not slot:
            raise NotFoundException("Slot not found")
        if slot.university_id != student.university_id:
            raise ForbiddenException("You cannot book slots from another university")

        now = utc_now()
        slot_start = ensure_utc(slot.start_time)
        if slot_start <= now:
            raise ConflictException("Cannot book a past time slot")

        existing_booking = session.exec(
            select(Booking).where(
                Booking.student_id == student.id,
                Booking.slot_id == slot_id,
                Booking.university_id == student.university_id,
            )
        ).first()
        if existing_booking:
            raise ConflictException("You already booked or queued this slot")

        # Prevent student from booking overlapping slots (conflict), regardless of status.
        student_bookings = session.exec(
            select(Booking).join(Slot).where(
                Booking.student_id == student.id, Booking.university_id == student.university_id
            )
        ).all()
        for b in student_bookings:
            other_slot = b.slot
            if not other_slot:
                continue
            if other_slot.id == slot.id:
                continue
            slot_end = ensure_utc(slot.end_time)
            other_start = ensure_utc(other_slot.start_time)
            other_end = ensure_utc(other_slot.end_time)
            if not (slot_end <= other_start or slot_start >= other_end):
                raise ConflictException("Booking time conflicts with another slot")

        if not slot.is_booked:
            slot.is_booked = True
            status_value = BookingStatus.booked
        else:
            queued_count = session.exec(
                select(Booking).where(
                    Booking.slot_id == slot_id,
                    Booking.status == BookingStatus.queued,
                    Booking.university_id == student.university_id,
                )
            ).all()
            if len(queued_count) >= BookingService.MAX_QUEUE_SIZE:
                raise ConflictException("Queue is full for this slot")
            status_value = BookingStatus.queued

        booking = Booking(student_id=student.id, slot_id=slot_id, status=status_value)
        booking.university_id = student.university_id
        session.add(booking)
        session.commit()
        session.refresh(booking)
        logger.info(
            "Booking created: id=%s slot_id=%s student_id=%s status=%s",
            booking.id,
            booking.slot_id,
            booking.student_id,
            booking.status,
        )
        if booking.status == BookingStatus.booked:
            NotificationService.booking_confirmed(student, slot)
            NotificationService.schedule_booking_reminder(student, slot)
            NotificationService.create_notification(
                session,
                student,
                f"You booked a slot at {slot.start_time}",
                subject="Booking Confirmed",
            )
        elif booking.status == BookingStatus.queued:
            NotificationService.create_notification(
                session,
                student,
                f"You are added to queue for slot at {slot.start_time}",
                subject="Booking Queued",
            )
        return BookingService._to_read(session=session, booking=booking, slot=slot)

    @staticmethod
    def get_student_bookings(
        *,
        session: Session,
        student: User,
        limit: int = 10,
        offset: int = 0,
        upcoming: bool = False,
    ) -> list[dict]:
        query = select(Booking, Slot).join(Slot).where(
            Booking.student_id == student.id, Booking.university_id == student.university_id
        )
        if upcoming:
            query = query.where(Slot.start_time > utc_now())
        rows = session.exec(
            query.offset(offset).limit(limit)
        ).all()
        return [BookingService._to_read(session=session, booking=b, slot=s) for b, s in rows]

    @staticmethod
    def get_professor_bookings(
        *,
        session: Session,
        professor: User,
        limit: int = 10,
        offset: int = 0,
        upcoming: bool = False,
    ) -> list[dict]:
        query = select(Booking, Slot).join(Slot).where(
            Slot.professor_id == professor.id,
            Booking.university_id == professor.university_id,
        )
        if upcoming:
            query = query.where(Slot.start_time > utc_now())
        rows = session.exec(query.offset(offset).limit(limit)).all()
        return [BookingService._to_read(session=session, booking=b, slot=s) for b, s in rows]

    @staticmethod
    def get_all_bookings(
        *,
        session: Session,
        university_id: int,
        limit: int = 10,
        offset: int = 0,
        upcoming: bool = False,
    ) -> list[dict]:
        query = select(Booking, Slot).join(Slot).where(Booking.university_id == university_id)
        if upcoming:
            query = query.where(Slot.start_time > utc_now())
        rows = session.exec(query.offset(offset).limit(limit)).all()
        return [BookingService._to_read(session=session, booking=b, slot=s) for b, s in rows]

    @staticmethod
    def cancel_booking(*, session: Session, student: User, booking_id: int) -> None:
        booking = session.get(Booking, booking_id)
        if not booking:
            raise NotFoundException("Booking not found")
        if booking.university_id != student.university_id:
            raise ForbiddenException("You cannot access bookings from another university")
        if booking.student_id != student.id:
            raise ForbiddenException("You can only cancel your own bookings")

        slot = session.get(Slot, booking.slot_id)
        if slot and slot.university_id != student.university_id:
            raise ForbiddenException("You cannot access slots from another university")

        if booking.status == BookingStatus.booked:
            next_in_queue = session.exec(
                select(Booking)
                .where(
                    Booking.slot_id == booking.slot_id,
                    Booking.status == BookingStatus.queued,
                    Booking.university_id == student.university_id,
                )
                .order_by(Booking.created_at)
            ).first()

            if next_in_queue:
                next_in_queue.status = BookingStatus.booked
                if slot:
                    slot.is_booked = True
                next_user = session.get(User, next_in_queue.student_id)
                if next_user and slot:
                    NotificationService.moved_from_queue(next_user, slot)
                    NotificationService.schedule_booking_reminder(next_user, slot)
                    NotificationService.create_notification(
                        session,
                        next_user,
                        f"You were moved from queue to booked for {slot.start_time}",
                        subject="You are now booked!",
                    )
            else:
                if slot:
                    slot.is_booked = False

        if slot:
            NotificationService.booking_cancelled(student, slot)
            NotificationService.create_notification(
                session,
                student,
                f"Your booking at {slot.start_time} was cancelled",
                subject="Booking Cancelled",
            )

        session.delete(booking)
        session.commit()
