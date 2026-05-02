from typing import List, Optional

from sqlalchemy import Column
from sqlalchemy import Enum as SAEnum
from sqlmodel import Field, Relationship, SQLModel

from app.models.enums import UserRole


class User(SQLModel, table=True):
    __tablename__ = "users"

    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(index=True, unique=True)
    password_hash: str
    role: UserRole = Field(sa_column=Column(SAEnum(UserRole, native_enum=False, length=32)))
    first_name: Optional[str] = Field(default=None, max_length=100)
    last_name: Optional[str] = Field(default=None, max_length=100)
    avatar_image_id: Optional[int] = Field(default=None, foreign_key="images.id")

    university_id: Optional[int] = Field(default=None, foreign_key="universities.id")
    slots: List["Slot"] = Relationship(back_populates="professor")
    bookings: List["Booking"] = Relationship(back_populates="student")
    reservations: List["Reservation"] = Relationship(back_populates="user")
    university: Optional["University"] = Relationship(back_populates="users")
