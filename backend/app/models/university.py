from sqlmodel import SQLModel, Field, Relationship
from typing import Optional, List


class University(SQLModel, table=True):
    __tablename__ = "universities"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True, unique=True)

    users: List["User"] = Relationship(back_populates="university")
