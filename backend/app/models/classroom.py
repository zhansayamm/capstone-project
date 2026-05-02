from typing import Optional, List

from sqlalchemy import UniqueConstraint
from sqlmodel import SQLModel, Field, Relationship


class Classroom(SQLModel, table=True):
    __tablename__ = "classrooms"
    __table_args__ = (UniqueConstraint("name", "university_id", name="uq_classroom_name_per_university"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    university_id: Optional[int] = Field(default=None, foreign_key="universities.id")
    name: str
    capacity: int = Field(nullable=False)

    reservations: List["Reservation"] = Relationship(back_populates="classroom")