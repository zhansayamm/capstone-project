from sqlmodel import Session, select

from app.models.booking import Booking
from app.models.classroom import Classroom
from app.models.enums import BookingStatus
from app.models.reservation import Reservation
from app.models.slot import Slot
from app.models.user import User


class AdminService:
    @staticmethod
    def get_totals(*, session: Session, admin: User) -> dict:
        total_users = len(
            session.exec(select(User).where(User.university_id == admin.university_id)).all()
        )
        total_slots = len(
            session.exec(select(Slot).where(Slot.university_id == admin.university_id)).all()
        )
        total_bookings = len(
            session.exec(select(Booking).where(Booking.university_id == admin.university_id)).all()
        )
        total_reservations = len(
            session.exec(
                select(Reservation).where(Reservation.university_id == admin.university_id)
            ).all()
        )

        return {
            "total_users": total_users,
            "total_slots": total_slots,
            "total_bookings": total_bookings,
            "total_reservations": total_reservations,
        }

    @staticmethod
    def get_booking_stats(*, session: Session, admin: User) -> dict:
        bookings = session.exec(
            select(Booking).where(Booking.university_id == admin.university_id)
        ).all()
        booked = sum(1 for b in bookings if b.status == BookingStatus.booked)
        queued = sum(1 for b in bookings if b.status == BookingStatus.queued)
        return {"booked": booked, "queued": queued}

    @staticmethod
    def get_top_professors(*, session: Session, admin: User) -> list[dict]:
        slots = session.exec(select(Slot).where(Slot.university_id == admin.university_id)).all()
        professor_count: dict[int, int] = {}
        for slot in slots:
            professor_count[slot.professor_id] = professor_count.get(slot.professor_id, 0) + 1

        sorted_professors = sorted(professor_count.items(), key=lambda x: x[1], reverse=True)
        results: list[dict] = []
        for pid, count in sorted_professors:
            prof = session.get(User, pid)
            results.append(
                {
                    "professor_id": pid,
                    "professor_name": f"{(prof.first_name or '').strip()} {(prof.last_name or '').strip()}".strip() if prof else None,
                    "slots_created": count,
                }
            )
        return results

    @staticmethod
    def get_top_classrooms(*, session: Session, admin: User) -> list[dict]:
        reservations = session.exec(
            select(Reservation).where(Reservation.university_id == admin.university_id)
        ).all()
        classroom_count: dict[int, int] = {}
        for r in reservations:
            classroom_count[r.classroom_id] = classroom_count.get(r.classroom_id, 0) + 1

        sorted_classrooms = sorted(classroom_count.items(), key=lambda x: x[1], reverse=True)
        results: list[dict] = []
        for cid, count in sorted_classrooms:
            classroom = session.get(Classroom, cid)
            results.append(
                {
                    "classroom_id": cid,
                    "classroom_name": classroom.name if classroom else None,
                    "reservations": count,
                }
            )
        return results
