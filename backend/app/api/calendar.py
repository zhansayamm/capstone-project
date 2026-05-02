from __future__ import annotations

from datetime import timezone

from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlmodel import Session, select

from app.core.deps import get_current_user, require_professor, require_student
from app.db import get_session
from app.models.booking import Booking
from app.models.classroom import Classroom
from app.models.enums import BookingStatus
from app.models.reservation import Reservation
from app.models.slot import Slot
from app.models.user import User
from app.schemas.slot import SlotRead
from app.services.calendar_service import CalendarService
from app.utils.datetime_utils import to_local

calendar_router = APIRouter()

_WEEKDAY_KEYS = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
]


def _weekday_bucket(start_time) -> str:
    """Map slot start to monday..sunday using UTC isoweekday (Mon=1 .. Sun=7)."""
    dt = start_time
    if getattr(dt, "tzinfo", None) is None:
        dt = dt.replace(tzinfo=timezone.utc)
    else:
        dt = dt.astimezone(timezone.utc)
    idx = dt.isoweekday() - 1
    return _WEEKDAY_KEYS[idx]


def _empty_week() -> dict[str, list]:
    return {k: [] for k in _WEEKDAY_KEYS}


@calendar_router.get("/professor")
def professor_week_schedule(
    current_user: User = Depends(require_professor),
    session: Session = Depends(get_session),
):
    slots = session.exec(
        select(Slot).where(
            Slot.professor_id == current_user.id,
            Slot.university_id == current_user.university_id,
        )
    ).all()
    week = _empty_week()
    for slot in sorted(slots, key=lambda s: s.start_time):
        professor = session.get(User, slot.professor_id)
        payload = SlotRead.model_validate(slot).model_dump()
        payload["start_time"] = to_local(slot.start_time)
        payload["end_time"] = to_local(slot.end_time)
        payload["professor"] = professor
        week[_weekday_bucket(slot.start_time)].append(payload)
    return week


def _booking_with_slot_dict(*, session: Session, booking: Booking, slot: Slot) -> dict:
    professor = session.get(User, slot.professor_id)
    slot_payload = SlotRead.model_validate(slot).model_dump()
    slot_payload["start_time"] = to_local(slot.start_time)
    slot_payload["end_time"] = to_local(slot.end_time)
    return {
        "id": booking.id,
        "status": booking.status,
        "created_at": to_local(booking.created_at),
        "slot": {
            **slot_payload,
            "professor": professor,
        },
    }


@calendar_router.get("/student")
def student_schedule(
    current_user: User = Depends(require_student),
    session: Session = Depends(get_session),
):
    booked: list[dict] = []
    queued: list[dict] = []

    rows = session.exec(
        select(Booking, Slot)
        .join(Slot)
        .where(
            Booking.student_id == current_user.id,
            Booking.university_id == current_user.university_id,
        )
    ).all()
    for booking, slot in rows:
        payload = _booking_with_slot_dict(session=session, booking=booking, slot=slot)
        if booking.status == BookingStatus.booked:
            booked.append(payload)
        elif booking.status == BookingStatus.queued:
            queued.append(payload)

    res_rows = session.exec(
        select(Reservation, Classroom)
        .join(Classroom)
        .where(
            Reservation.user_id == current_user.id,
            Reservation.university_id == current_user.university_id,
        )
    ).all()
    reservations = []
    for reservation, classroom in res_rows:
        reservations.append(
            {
                "id": reservation.id,
                "classroom_id": reservation.classroom_id,
                "classroom_name": classroom.name,
                "university_id": reservation.university_id,
                "user_id": reservation.user_id,
                "start_time": to_local(reservation.start_time),
                "end_time": to_local(reservation.end_time),
                "created_at": to_local(reservation.created_at),
            }
        )

    return {"booked": booked, "queued": queued, "reservations": reservations}


@calendar_router.get("/me")
def get_my_calendar(
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    calendar = CalendarService.generate_user_calendar(session, user)
    ics_body = str(calendar)
    return Response(
        content=ics_body.encode("utf-8"),
        media_type="text/calendar; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="my_calendar.ics"'},
    )
