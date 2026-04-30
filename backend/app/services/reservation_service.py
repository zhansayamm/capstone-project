from app.core.exceptions import ConflictException, ForbiddenException, NotFoundException
from sqlmodel import Session, select
from datetime import datetime, timezone

from app.models.classroom import Classroom
from app.models.reservation import Reservation
from app.models.user import User
from app.schemas.reservation import ReservationCreate
from app.services.notification_service import NotificationService
from app.utils.datetime_utils import ensure_utc, is_within_business_hours


class ReservationService:
    @staticmethod
    def _to_read(*, session: Session, reservation: Reservation, classroom: Classroom) -> dict:
        user = session.get(User, reservation.user_id)
        return {
            "id": reservation.id,
            "classroom_id": reservation.classroom_id,
            "classroom_name": classroom.name,
            "university_id": reservation.university_id,
            "user_id": reservation.user_id,
            "start_time": reservation.start_time,
            "end_time": reservation.end_time,
            "created_at": reservation.created_at,
            "user": user,
        }

    @staticmethod
    def create_reservation(*, session: Session, user: User, data: ReservationCreate) -> dict:
        classroom = session.get(Classroom, data.classroom_id)
        if not classroom:
            raise NotFoundException("Classroom not found")
        if classroom.university_id != user.university_id:
            raise ForbiddenException("You cannot reserve classrooms from another university")

        if data.start_time.tzinfo is None:
            data.start_time = data.start_time.replace(tzinfo=timezone.utc)
        if data.end_time.tzinfo is None:
            data.end_time = data.end_time.replace(tzinfo=timezone.utc)

        if data.start_time >= data.end_time:
            raise ConflictException("Invalid time range")

        if not is_within_business_hours(data.start_time, data.end_time):
            raise ConflictException("Reservations must be within 08:30–17:30 UTC on the same day")

        now = datetime.now(timezone.utc)
        if data.start_time <= now:
            raise ConflictException("Cannot create a reservation in the past")

        # Student daily reservation limit: max 1 hour per UTC day.
        day = ensure_utc(data.start_time).date()
        day_start = datetime(day.year, day.month, day.day, tzinfo=timezone.utc)
        day_end = day_start.replace(hour=23, minute=59, second=59, microsecond=999999)
        existing_for_day = session.exec(
            select(Reservation).where(
                Reservation.user_id == user.id,
                Reservation.university_id == user.university_id,
                Reservation.start_time >= day_start,
                Reservation.start_time <= day_end,
            )
        ).all()
        already_seconds = 0.0
        for r in existing_for_day:
            r_start = ensure_utc(r.start_time)
            r_end = ensure_utc(r.end_time)
            already_seconds += max(0.0, (r_end - r_start).total_seconds())

        new_seconds = (ensure_utc(data.end_time) - ensure_utc(data.start_time)).total_seconds()
        if already_seconds + new_seconds > 3600:
            raise ConflictException("Daily reservation limit exceeded (max 1 hour per day)")

        existing_reservations = session.exec(
            select(Reservation).where(
                Reservation.classroom_id == data.classroom_id,
                Reservation.university_id == user.university_id,
            )
        ).all()

        for r in existing_reservations:
            r_start = r.start_time
            r_end = r.end_time
            if r_start.tzinfo is None:
                r_start = r_start.replace(tzinfo=timezone.utc)
            if r_end.tzinfo is None:
                r_end = r_end.replace(tzinfo=timezone.utc)
            if not (data.end_time <= r_start or data.start_time >= r_end):
                raise ConflictException("Classroom already reserved for this time")

        reservation = Reservation(
            classroom_id=data.classroom_id,
            user_id=user.id,
            university_id=user.university_id,
            start_time=data.start_time,
            end_time=data.end_time,
        )

        session.add(reservation)
        session.commit()
        session.refresh(reservation)
        NotificationService.reservation_confirmed(user, reservation, classroom)
        NotificationService.schedule_reservation_reminder(user, reservation, classroom)
        NotificationService.create_notification(
            session,
            user,
            f"Classroom {classroom.name} reserved at {reservation.start_time}",
            subject="Reservation Confirmed",
        )
        return ReservationService._to_read(session=session, reservation=reservation, classroom=classroom)

    @staticmethod
    def get_user_reservations(
        *,
        session: Session,
        user: User,
        limit: int = 10,
        offset: int = 0,
        upcoming: bool = False,
    ) -> list[dict]:
        query = select(Reservation, Classroom).join(Classroom).where(
            Reservation.user_id == user.id, Reservation.university_id == user.university_id
        )
        if upcoming:
            query = query.where(Reservation.start_time > datetime.now(timezone.utc))
        rows = session.exec(query.offset(offset).limit(limit)).all()
        return [ReservationService._to_read(session=session, reservation=r, classroom=c) for r, c in rows]

    @staticmethod
    def get_all_reservations(
        *,
        session: Session,
        university_id: int,
        limit: int = 10,
        offset: int = 0,
        classroom_id: int | None = None,
        user_id: int | None = None,
        upcoming: bool = False,
    ) -> list[dict]:
        query = select(Reservation, Classroom).join(Classroom).where(
            Reservation.university_id == university_id
        )
        if classroom_id is not None:
            query = query.where(Reservation.classroom_id == classroom_id)
        if user_id is not None:
            query = query.where(Reservation.user_id == user_id)
        if upcoming:
            query = query.where(Reservation.start_time > datetime.now(timezone.utc))
        rows = session.exec(query.offset(offset).limit(limit)).all()
        return [ReservationService._to_read(session=session, reservation=r, classroom=c) for r, c in rows]
