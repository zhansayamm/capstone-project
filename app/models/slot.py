from __future__ import annotations
from sqlmodel import SQLModel, Field, Relationship
from typing import Optional, List
from datetime import datetime

class Slot(SQLModel, table=True):
    __tablename__ = "slots"

    id: Optional[int] = Field(default=None, primary_key=True)
    professor_id: int = Field(foreign_key="users.id")

    start_time: datetime
    end_time: datetime

    is_booked: bool = False

    professor: Optional["User"] = Relationship(back_populates="slots")
    bookings: List["Booking"] = Relationship(back_populates="slot")