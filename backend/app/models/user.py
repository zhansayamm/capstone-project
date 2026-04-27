from __future__ import annotations
from sqlmodel import SQLModel, Field, Relationship
from typing import Optional, List
from app.models.enums import UserRole

class User(SQLModel, table=True):
    __tablename__ = "users"

    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(index=True, unique=True)
    password_hash: str
    role: UserRole

    slots: List["Slot"] = Relationship(back_populates="professor")
    bookings: List["Booking"] = Relationship(back_populates="student")
    reservations: List["Reservation"] = Relationship(back_populates="user")