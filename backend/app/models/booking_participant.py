from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, SQLModel


class BookingParticipant(SQLModel, table=True):
    __tablename__ = "booking_participants"
    __table_args__ = (UniqueConstraint("booking_id", "student_id", name="uq_booking_participant"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    booking_id: int = Field(foreign_key="bookings.id", index=True)
    student_id: int = Field(foreign_key="users.id", index=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

