from app.core.exceptions import ConflictException, ForbiddenException, NotFoundException
from sqlmodel import Session, select
from datetime import datetime, timezone
import logging

from app.models.classroom import Classroom
from app.models.reservation import Reservation
from app.models.user import User
from app.schemas.reservation import ReservationCreate
from app.services.notification_service import NotificationService
from app.utils.datetime_utils import BUSINESS_END_LOCAL, BUSINESS_START_LOCAL, ensure_utc, is_within_business_hours, to_local

logger = logging.getLogger(__name__)

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
            "start_time": to_local(reservation.start_time),
            "end_time": to_local(reservation.end_time),
            "created_at": to_local(reservation.created_at),
            "user": user,
        }

    @staticmethod
    def create_reservation(*, session: Session, user: User, data: ReservationCreate) -> dict:
        logger.info(
            "create_reservation: user_id=%s classroom_id=%s start=%s end=%s",
            user.id,
            data.classroom_id,
            data.start_time,
            data.end_time,
        )
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

        # Each reservation must be exactly 1 hour.
        duration_seconds = (ensure_utc(data.end_time) - ensure_utc(data.start_time)).total_seconds()
        if duration_seconds != 3600:
            logger.info("create_reservation: invalid duration_seconds=%s", duration_seconds)
            raise ConflictException("Reservation must be exactly 1 hour")

        local_start = to_local(data.start_time)
        local_end = to_local(data.end_time)
        s_time = local_start.time().replace(tzinfo=None)
        e_time = local_end.time().replace(tzinfo=None)
        if s_time < BUSINESS_START_LOCAL:
            raise ConflictException("Reservations cannot start before 08:30")
        if e_time > BUSINESS_END_LOCAL:
            raise ConflictException("Reservations must end before 17:30")

        if not is_within_business_hours(data.start_time, data.end_time):
            logger.info("create_reservation: outside business hours")
            raise ConflictException("Reservations must be within 08:30–17:30 on the same day")

        now = datetime.now(timezone.utc)
        if data.start_time <= now:
            logger.info("create_reservation: start_time in past now=%s", now)
            raise ConflictException("Cannot create a reservation in the past")

        # A user can reserve the same classroom only once per UTC day.
        day = ensure_utc(data.start_time).date()
        day_start = datetime(day.year, day.month, day.day, tzinfo=timezone.utc)
        day_end = day_start.replace(hour=23, minute=59, second=59, microsecond=999999)
        existing_same_day = session.exec(
            select(Reservation).where(
                Reservation.user_id == user.id,
                Reservation.classroom_id == data.classroom_id,
                Reservation.university_id == user.university_id,
                Reservation.start_time >= day_start,
                Reservation.start_time <= day_end,
            )
        ).first()
        if existing_same_day:
            logger.info("create_reservation: duplicate same classroom same day reservation_id=%s", existing_same_day.id)
            raise ConflictException("You have already reserved this classroom today")

        existing_reservations = session.exec(
            select(Reservation).where(
                Reservation.classroom_id == data.classroom_id,
                Reservation.university_id == user.university_id,
            )
        ).all()
        logger.info("create_reservation: overlap_candidates=%s", len(existing_reservations))

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
