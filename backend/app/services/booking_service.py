from app.core.exceptions import ConflictException, ForbiddenException, NotFoundException
from sqlmodel import Session, select
import logging

from app.models.booking import Booking
from app.models.booking_participant import BookingParticipant
from app.models.enums import BookingStatus
from app.models.slot import Slot
from app.models.user import User
from app.services.notification_service import NotificationService
from app.utils.datetime_utils import ensure_utc, to_local, utc_now


logger = logging.getLogger(__name__)


class BookingService:
    @staticmethod
    def _normalize_status(status: BookingStatus) -> BookingStatus:
        # Backward compatibility: map old values into new workflow
        if status == BookingStatus.booked:
            return BookingStatus.approved
        if status == BookingStatus.queued:
            return BookingStatus.pending
        return status

    @staticmethod
    def _is_active(status: BookingStatus) -> bool:
        s = BookingService._normalize_status(status)
        return s in (BookingStatus.pending, BookingStatus.approved)

    @staticmethod
    def _is_approved(status: BookingStatus) -> bool:
        return BookingService._normalize_status(status) == BookingStatus.approved

    @staticmethod
    def _approved_count(*, session: Session, slot_id: int) -> int:
        rows = session.exec(select(Booking).where(Booking.slot_id == slot_id)).all()
        return sum(1 for b in rows if BookingService._is_approved(b.status))

    @staticmethod
    def _to_read(*, session: Session, booking: Booking, slot: Slot) -> dict:
        normalized_status = BookingService._normalize_status(booking.status)
        professor = session.get(User, slot.professor_id)
        student = session.get(User, booking.student_id)

        participants_rows = session.exec(
            select(BookingParticipant).where(BookingParticipant.booking_id == booking.id)
        ).all()
        participant_users = [session.get(User, p.student_id) for p in participants_rows]
        participant_users = [u for u in participant_users if u is not None]
        return {
            "id": booking.id,
            "student_id": booking.student_id,
            "slot_id": booking.slot_id,
            "university_id": booking.university_id,
            "status": normalized_status,
            "created_at": to_local(booking.created_at),
            "description": booking.description,
            "slot": {
                "professor_id": slot.professor_id,
                "university_id": slot.university_id,
                "start_time": to_local(slot.start_time),
                "end_time": to_local(slot.end_time),
                "title": slot.title,
                "description": slot.description,
                "professor": professor,
            },
            "participants_count": max(1, len(participant_users) or 1),
            "participants": participant_users if participant_users else None,
            "queue_position": None,
            "student": student,
        }

    @staticmethod
    def create_booking(
        *,
        session: Session,
        student: User,
        slot_id: int,
        description: str | None = None,
        participants: list[int] | None = None,
    ) -> dict:
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
        if existing_booking and BookingService._is_active(existing_booking.status):
            raise ConflictException("You already have an active booking request for this slot")

        student_bookings = session.exec(
            select(Booking).join(Slot).where(
                Booking.student_id == student.id, Booking.university_id == student.university_id
            )
        ).all()
        for b in student_bookings:
            if not BookingService._is_active(b.status):
                continue
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

        # New workflow: approval required, capacity enforced on approval
        status_value = BookingStatus.pending

        booking = Booking(student_id=student.id, slot_id=slot_id, status=status_value, description=description)
        booking.university_id = student.university_id
        session.add(booking)
        session.commit()
        session.refresh(booking)

        # Persist participants (creator + optional additional students)
        participant_ids: set[int] = {student.id}
        if participants:
            for pid in participants:
                try:
                    pid_int = int(pid)
                except Exception:
                    raise ConflictException("Invalid participant id")
                if pid_int != student.id:
                    participant_ids.add(pid_int)

        for pid in participant_ids:
            u = session.get(User, pid)
            if not u:
                raise NotFoundException(f"Participant user_id={pid} not found")
            if u.university_id != student.university_id:
                raise ForbiddenException("Participants must be from the same university")
            if u.role != "student":
                raise ConflictException("Participants must be students")
            session.add(BookingParticipant(booking_id=booking.id, student_id=u.id))
        session.commit()
        logger.info(
            "Booking created: id=%s slot_id=%s student_id=%s status=%s",
            booking.id,
            booking.slot_id,
            booking.student_id,
            booking.status,
        )
        NotificationService.create_notification(
            session,
            student,
            f"Booking request submitted for {slot.title} at {slot.start_time}",
            subject="Booking Pending",
        )
        return BookingService._to_read(session=session, booking=booking, slot=slot)

    @staticmethod
    def approve_booking(*, session: Session, professor: User, booking_id: int) -> dict:
        booking = session.get(Booking, booking_id)
        if not booking:
            raise NotFoundException("Booking not found")
        slot = session.get(Slot, booking.slot_id)
        if not slot:
            raise NotFoundException("Slot not found")
        if slot.university_id != professor.university_id or slot.professor_id != professor.id:
            raise ForbiddenException("You can only approve bookings for your own slots")

        if BookingService._normalize_status(booking.status) != BookingStatus.pending:
            raise ConflictException("Only pending bookings can be approved")

        if ensure_utc(slot.start_time) <= utc_now():
            raise ConflictException("Cannot approve bookings for past slots")

        capacity = int(getattr(slot, "capacity", 1) or 1)
        approved_count = BookingService._approved_count(session=session, slot_id=slot.id)
        if approved_count >= capacity:
            raise ConflictException("Slot capacity reached")

        booking.status = BookingStatus.approved
        session.add(booking)
        session.commit()
        session.refresh(booking)

        # Keep Slot.is_booked maintained for existing list filters/UI
        approved_after = BookingService._approved_count(session=session, slot_id=slot.id)
        slot.is_booked = approved_after >= capacity
        session.add(slot)
        session.commit()

        participants = session.exec(
            select(BookingParticipant).where(BookingParticipant.booking_id == booking.id)
        ).all()
        for p in participants:
            u = session.get(User, p.student_id)
            if not u:
                continue
            NotificationService.booking_confirmed(u, slot)
            NotificationService.schedule_booking_reminder(u, slot)
            NotificationService.create_notification(
                session,
                u,
                f"Booking approved for {slot.title} at {slot.start_time}",
                subject="Booking Approved",
            )

        return BookingService._to_read(session=session, booking=booking, slot=slot)

    @staticmethod
    def reject_booking(*, session: Session, professor: User, booking_id: int) -> dict:
        booking = session.get(Booking, booking_id)
        if not booking:
            raise NotFoundException("Booking not found")
        slot = session.get(Slot, booking.slot_id)
        if not slot:
            raise NotFoundException("Slot not found")
        if slot.university_id != professor.university_id or slot.professor_id != professor.id:
            raise ForbiddenException("You can only reject bookings for your own slots")

        if BookingService._normalize_status(booking.status) != BookingStatus.pending:
            raise ConflictException("Only pending bookings can be rejected")

        booking.status = BookingStatus.rejected
        session.add(booking)
        session.commit()
        session.refresh(booking)

        owner = session.get(User, booking.student_id)
        if owner:
            NotificationService.create_notification(
                session,
                owner,
                f"Booking rejected for {slot.title} at {slot.start_time}",
                subject="Booking Rejected",
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

        was_approved = BookingService._is_approved(booking.status)
        booking.status = BookingStatus.cancelled
        session.add(booking)
        session.commit()

        if slot and was_approved:
            capacity = int(getattr(slot, "capacity", 1) or 1)
            approved_now = BookingService._approved_count(session=session, slot_id=slot.id)
            slot.is_booked = approved_now >= capacity
            session.add(slot)
            session.commit()

        if slot:
            NotificationService.booking_cancelled(student, slot)
            NotificationService.create_notification(
                session,
                student,
                f"Your booking at {slot.start_time} was cancelled",
                subject="Booking Cancelled",
            )
