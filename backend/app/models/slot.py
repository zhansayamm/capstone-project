from sqlmodel import SQLModel, Field, Relationship
from typing import Optional, List
from datetime import datetime

class Slot(SQLModel, table=True):
    __tablename__ = "slots"

    id: Optional[int] = Field(default=None, primary_key=True)
    professor_id: int = Field(foreign_key="users.id")
    university_id: Optional[int] = Field(default=None, foreign_key="universities.id")

    start_time: datetime
    end_time: datetime
    duration_minutes: int = Field(default=30)

    title: str = Field(default="General", max_length=100)
    description: str | None = Field(default=None)

    is_booked: bool = False

    professor: Optional["User"] = Relationship(back_populates="slots")
    bookings: List["Booking"] = Relationship(back_populates="slot")