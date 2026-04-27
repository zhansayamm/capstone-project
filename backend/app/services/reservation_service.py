from fastapi import HTTPException
from sqlmodel import Session, select
from datetime import datetime

from app.models.classroom import Classroom
from app.models.reservation import Reservation
from app.models.user import User
from app.schemas.reservation import ReservationCreate


class ReservationService:
    @staticmethod
    def create_reservation(*, session: Session, user: User, data: ReservationCreate) -> Reservation:
        classroom = session.get(Classroom, data.classroom_id)
        if not classroom:
            raise HTTPException(status_code=404, detail="Classroom not found")

        if data.start_time >= data.end_time:
            raise HTTPException(status_code=400, detail="Invalid time range")

        now = datetime.utcnow()
        if data.start_time <= now:
            raise HTTPException(status_code=400, detail="Cannot create a reservation in the past")

        existing_reservations = session.exec(
            select(Reservation).where(Reservation.classroom_id == data.classroom_id)
        ).all()

        for r in existing_reservations:
            if not (data.end_time <= r.start_time or data.start_time >= r.end_time):
                raise HTTPException(
                    status_code=400, detail="Classroom already reserved for this time"
                )

        reservation = Reservation(
            classroom_id=data.classroom_id,
            user_id=user.id,
            start_time=data.start_time,
            end_time=data.end_time,
        )

        session.add(reservation)
        session.commit()
        session.refresh(reservation)
        return reservation

    @staticmethod
    def get_user_reservations(*, session: Session, user: User) -> list[Reservation]:
        return session.exec(select(Reservation).where(Reservation.user_id == user.id)).all()

    @staticmethod
    def get_all_reservations(*, session: Session) -> list[Reservation]:
        return session.exec(select(Reservation)).all()
