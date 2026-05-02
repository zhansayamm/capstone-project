from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel


class BookingMessage(SQLModel, table=True):
    __tablename__ = "booking_messages"

    id: Optional[int] = Field(default=None, primary_key=True)
    booking_id: int = Field(foreign_key="bookings.id", index=True)
    sender_id: int = Field(foreign_key="users.id", index=True)
    message: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

