from __future__ import annotations
from sqlmodel import SQLModel, Field, Relationship
from typing import Optional, List

class Classroom(SQLModel, table=True):
    __tablename__ = "classrooms"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    capacity: Optional[int] = None

    reservations: List["Reservation"] = Relationship(back_populates="classroom")