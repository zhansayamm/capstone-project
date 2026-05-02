from sqlmodel import SQLModel, Field, Relationship
from typing import Optional
from datetime import datetime, timezone
from app.models.enums import BookingStatus

class Booking(SQLModel, table=True):
    __tablename__ = "bookings"

    id: Optional[int] = Field(default=None, primary_key=True)

    student_id: int = Field(foreign_key="users.id")
    slot_id: int = Field(foreign_key="slots.id")
    university_id: Optional[int] = Field(default=None, foreign_key="universities.id")

    status: BookingStatus = BookingStatus.booked
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    description: Optional[str] = Field(default=None, max_length=200)

    student: Optional["User"] = Relationship(back_populates="bookings")
    slot: Optional["Slot"] = Relationship(back_populates="bookings")