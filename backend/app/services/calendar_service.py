from __future__ import annotations

from datetime import datetime, timezone

from ics import Calendar, Event
from sqlmodel import Session, select

from app.models import Booking, Reservation
from app.models.classroom import Classroom
from app.models.enums import BookingStatus
from app.models.slot import Slot
from app.models.user import User


def _as_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


class CalendarService:
    @staticmethod
    def generate_user_calendar(session: Session, user: User) -> Calendar:
        calendar = Calendar()

        booking_rows = session.exec(
            select(Booking, Slot)
            .join(Slot)
            .where(
                Booking.student_id == user.id,
                Booking.university_id == user.university_id,
                Booking.status == BookingStatus.booked,
            )
        ).all()

        for booking, slot in booking_rows:
            event = Event()
            event.name = "Office Hour"
            event.begin = _as_utc(slot.start_time)
            event.end = _as_utc(slot.end_time)
            event.description = f"Professor ID: {slot.professor_id}"
            event.uid = f"booking-{booking.id}@pmbooking"
            calendar.events.add(event)

        reservation_rows = session.exec(
            select(Reservation, Classroom)
            .join(Classroom)
            .where(
                Reservation.user_id == user.id,
                Reservation.university_id == user.university_id,
            )
        ).all()

        for res, classroom in reservation_rows:
            event = Event()
            event.name = f"Classroom {res.classroom_id}"
            event.begin = _as_utc(res.start_time)
            event.end = _as_utc(res.end_time)
            event.description = f"Classroom reservation ({classroom.name})"
            event.uid = f"reservation-{res.id}@pmbooking"
            calendar.events.add(event)

        return calendar
