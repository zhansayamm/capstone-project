from sqlmodel import Session, select
from fastapi import HTTPException

from app.models.classroom import Classroom
from app.models.reservation import Reservation
from app.schemas.classroom import ClassroomCreate


class ClassroomService:
    @staticmethod
    def create_classroom(*, session: Session, data: ClassroomCreate) -> Classroom:
        classroom = Classroom(name=data.name, capacity=data.capacity)
        session.add(classroom)
        session.commit()
        session.refresh(classroom)
        return classroom

    @staticmethod
    def list_classrooms(*, session: Session) -> list[Classroom]:
        return session.exec(select(Classroom)).all()

    @staticmethod
    def delete_classroom(*, session: Session, classroom_id: int) -> None:
        classroom = session.get(Classroom, classroom_id)
        if not classroom:
            raise HTTPException(status_code=404, detail="Classroom not found")

        has_reservation = session.exec(
            select(Reservation).where(Reservation.classroom_id == classroom_id)
        ).first()
        if has_reservation:
            raise HTTPException(
                status_code=400, detail="Cannot delete classroom with existing reservations"
            )

        session.delete(classroom)
        session.commit()
