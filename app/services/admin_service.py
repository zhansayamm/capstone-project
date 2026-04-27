from sqlmodel import Session, select

from app.models.booking import Booking
from app.models.classroom import Classroom
from app.models.enums import BookingStatus
from app.models.reservation import Reservation
from app.models.slot import Slot
from app.models.user import User


class AdminService:
    @staticmethod
    def get_totals(*, session: Session) -> dict:
        total_users = len(session.exec(select(User)).all())
        total_slots = len(session.exec(select(Slot)).all())
        total_bookings = len(session.exec(select(Booking)).all())
        total_reservations = len(session.exec(select(Reservation)).all())

        return {
            "total_users": total_users,
            "total_slots": total_slots,
            "total_bookings": total_bookings,
            "total_reservations": total_reservations,
        }

    @staticmethod
    def get_booking_stats(*, session: Session) -> dict:
        bookings = session.exec(select(Booking)).all()
        booked = sum(1 for b in bookings if b.status == BookingStatus.booked)
        queued = sum(1 for b in bookings if b.status == BookingStatus.queued)
        return {"booked": booked, "queued": queued}

    @staticmethod
    def get_top_professors(*, session: Session) -> list[dict]:
        slots = session.exec(select(Slot)).all()
        professor_count: dict[int, int] = {}
        for slot in slots:
            professor_count[slot.professor_id] = professor_count.get(slot.professor_id, 0) + 1

        sorted_professors = sorted(professor_count.items(), key=lambda x: x[1], reverse=True)
        return [{"professor_id": pid, "slots_created": count} for pid, count in sorted_professors]

    @staticmethod
    def get_top_classrooms(*, session: Session) -> list[dict]:
        reservations = session.exec(select(Reservation)).all()
        classroom_count: dict[int, int] = {}
        for r in reservations:
            classroom_count[r.classroom_id] = classroom_count.get(r.classroom_id, 0) + 1

        sorted_classrooms = sorted(classroom_count.items(), key=lambda x: x[1], reverse=True)
        return [
            {"classroom_id": cid, "reservations": count} for cid, count in sorted_classrooms
        ]
