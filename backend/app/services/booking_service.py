from fastapi import HTTPException
from sqlmodel import Session, select
from datetime import datetime

from app.models.booking import Booking
from app.models.enums import BookingStatus
from app.models.slot import Slot
from app.models.user import User


class BookingService:
    MAX_QUEUE_SIZE = 5

    @staticmethod
    def create_booking(*, session: Session, student: User, slot_id: int) -> Booking:
        slot = session.get(Slot, slot_id)
        if not slot:
            raise HTTPException(status_code=404, detail="Slot not found")

        now = datetime.utcnow()
        if slot.start_time <= now:
            raise HTTPException(status_code=400, detail="Cannot book a past time slot")

        existing_booking = session.exec(
            select(Booking).where(Booking.student_id == student.id, Booking.slot_id == slot_id)
        ).first()
        if existing_booking:
            raise HTTPException(status_code=400, detail="You already booked or queued this slot")

        # Prevent student from booking overlapping slots (conflict), regardless of status.
        student_bookings = session.exec(
            select(Booking).join(Slot).where(Booking.student_id == student.id)
        ).all()
        for b in student_bookings:
            other_slot = b.slot
            if not other_slot:
                continue
            if other_slot.id == slot.id:
                continue
            if not (slot.end_time <= other_slot.start_time or slot.start_time >= other_slot.end_time):
                raise HTTPException(status_code=400, detail="Booking time conflicts with another slot")

        if not slot.is_booked:
            slot.is_booked = True
            status_value = BookingStatus.booked
        else:
            queued_count = session.exec(
                select(Booking).where(
                    Booking.slot_id == slot_id, Booking.status == BookingStatus.queued
                )
            ).all()
            if len(queued_count) >= BookingService.MAX_QUEUE_SIZE:
                raise HTTPException(status_code=400, detail="Queue is full for this slot")
            status_value = BookingStatus.queued

        booking = Booking(student_id=student.id, slot_id=slot_id, status=status_value)
        session.add(booking)
        session.commit()
        session.refresh(booking)
        return booking

    @staticmethod
    def get_student_bookings(*, session: Session, student: User) -> list[Booking]:
        return session.exec(select(Booking).where(Booking.student_id == student.id)).all()

    @staticmethod
    def get_professor_bookings(*, session: Session, professor: User) -> list[Booking]:
        return session.exec(
            select(Booking).join(Slot).where(Slot.professor_id == professor.id)
        ).all()

    @staticmethod
    def cancel_booking(*, session: Session, student: User, booking_id: int) -> None:
        booking = session.get(Booking, booking_id)
        if not booking:
            raise HTTPException(status_code=404, detail="Booking not found")
        if booking.student_id != student.id:
            raise HTTPException(status_code=403, detail="You can only cancel your own bookings")

        slot = session.get(Slot, booking.slot_id)

        if booking.status == BookingStatus.booked:
            next_in_queue = session.exec(
                select(Booking)
                .where(Booking.slot_id == booking.slot_id, Booking.status == BookingStatus.queued)
                .order_by(Booking.created_at)
            ).first()

            if next_in_queue:
                next_in_queue.status = BookingStatus.booked
            else:
                if slot:
                    slot.is_booked = False

        session.delete(booking)
        session.commit()
