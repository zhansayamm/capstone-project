from sqlmodel import Session, select
from app.core.exceptions import ConflictException, ForbiddenException, NotFoundException

from app.models.classroom import Classroom
from app.models.reservation import Reservation
from app.models.user import User
from app.schemas.classroom import ClassroomCreate


class ClassroomService:
    @staticmethod
    def create_classroom(*, session: Session, admin: User, data: ClassroomCreate) -> Classroom:
        classroom = Classroom(
            name=data.name,
            capacity=data.capacity,
            university_id=admin.university_id,
        )
        session.add(classroom)
        session.commit()
        session.refresh(classroom)
        return classroom

    @staticmethod
    def list_classrooms(*, session: Session, university_id: int | None = None) -> list[Classroom]:
        query = select(Classroom)
        if university_id is not None:
            query = query.where(Classroom.university_id == university_id)
        return session.exec(query).all()

    @staticmethod
    def delete_classroom(*, session: Session, admin: User, classroom_id: int) -> None:
        classroom = session.get(Classroom, classroom_id)
        if not classroom:
            raise NotFoundException("Classroom not found")
        if classroom.university_id != admin.university_id:
            raise ForbiddenException("You cannot modify classrooms from another university")

        has_reservation = session.exec(
            select(Reservation).where(Reservation.classroom_id == classroom_id)
        ).first()
        if has_reservation:
            raise ConflictException("Cannot delete classroom with existing reservations")

        session.delete(classroom)
        session.commit()
