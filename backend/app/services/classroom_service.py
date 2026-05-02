from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from app.core.exceptions import ConflictException, ForbiddenException, NotFoundException

from app.models.classroom import Classroom
from app.models.reservation import Reservation
from app.models.user import User
from app.schemas.classroom import ClassroomCreate, ClassroomUpdate


class ClassroomService:
    @staticmethod
    def _commit_or_raise_conflict(session: Session) -> None:
        try:
            session.commit()
        except IntegrityError:
            session.rollback()
            raise ConflictException("Classroom name must be unique") from None

    @staticmethod
    def create_classroom(*, session: Session, admin: User, data: ClassroomCreate) -> Classroom:
        name = data.name.strip() if isinstance(data.name, str) else data.name
        if not name:
            raise ConflictException("Classroom name cannot be empty")

        existing = session.exec(
            select(Classroom).where(
                Classroom.name == name,
                Classroom.university_id == admin.university_id,
            )
        ).first()
        if existing:
            raise ConflictException("Classroom with this name already exists")

        classroom = Classroom(
            name=name,
            capacity=data.capacity,
            university_id=admin.university_id,
        )
        session.add(classroom)
        ClassroomService._commit_or_raise_conflict(session)
        session.refresh(classroom)
        return classroom

    @staticmethod
    def list_classrooms(*, session: Session, university_id: int | None = None) -> list[Classroom]:
        query = select(Classroom)
        if university_id is not None:
            query = query.where(Classroom.university_id == university_id)
        return session.exec(query).all()

    @staticmethod
    def update_classroom(
        *,
        session: Session,
        admin: User,
        classroom_id: int,
        data: ClassroomUpdate,
    ) -> Classroom:
        classroom = session.get(Classroom, classroom_id)
        if not classroom:
            raise NotFoundException("Classroom not found")
        if classroom.university_id != admin.university_id:
            raise ForbiddenException("You cannot modify classrooms from another university")

        if data.name is None and data.capacity is None:
            raise ConflictException("No fields to update")

        if data.name is not None:
            name = data.name.strip() if isinstance(data.name, str) else data.name
            if not name:
                raise ConflictException("Classroom name cannot be empty")
            dup = session.exec(
                select(Classroom).where(
                    Classroom.name == name,
                    Classroom.university_id == classroom.university_id,
                    Classroom.id != classroom.id,
                )
            ).first()
            if dup:
                raise ConflictException("Classroom with this name already exists")
            classroom.name = name
        if data.capacity is not None:
            if data.capacity <= 0:
                raise ConflictException("Capacity must be greater than 0")
            classroom.capacity = data.capacity

        session.add(classroom)
        ClassroomService._commit_or_raise_conflict(session)
        session.refresh(classroom)
        return classroom

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
