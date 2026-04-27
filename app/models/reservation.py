from __future__ import annotations
from sqlmodel import SQLModel, Field, Relationship
from typing import Optional
from datetime import datetime

class Reservation(SQLModel, table=True):
    __tablename__ = "reservations"

    id: Optional[int] = Field(default=None, primary_key=True)

    classroom_id: int = Field(foreign_key="classrooms.id")
    user_id: int = Field(foreign_key="users.id")

    start_time: datetime
    end_time: datetime

    created_at: datetime = Field(default_factory=datetime.utcnow)

    classroom: Optional["Classroom"] = Relationship(back_populates="reservations")
    user: Optional["User"] = Relationship(back_populates="reservations")