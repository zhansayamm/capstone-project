from __future__ import annotations
from sqlmodel import SQLModel, Field, Relationship
from typing import Optional
from datetime import datetime
from app.models.enums import BookingStatus

class Booking(SQLModel, table=True):
    __tablename__ = "bookings"

    id: Optional[int] = Field(default=None, primary_key=True)

    student_id: int = Field(foreign_key="users.id")
    slot_id: int = Field(foreign_key="slots.id")

    status: BookingStatus = BookingStatus.booked
    created_at: datetime = Field(default_factory=datetime.utcnow)

    student: Optional["User"] = Relationship(back_populates="bookings")
    slot: Optional["Slot"] = Relationship(back_populates="bookings")