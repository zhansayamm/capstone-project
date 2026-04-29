from sqlmodel import Session, select

from app.core.exceptions import ConflictException
from app.models.university import University


class UniversityService:
    @staticmethod
    def list_universities(*, session: Session) -> list[University]:
        return session.exec(select(University)).all()

    @staticmethod
    def create_university(*, session: Session, name: str) -> University:
        existing = session.exec(select(University).where(University.name == name)).first()
        if existing:
            raise ConflictException("University with this name already exists")

        uni = University(name=name)
        session.add(uni)
        session.commit()
        session.refresh(uni)
        return uni
