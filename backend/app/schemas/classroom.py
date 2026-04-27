from pydantic import BaseModel
from typing import Optional


class ClassroomCreate(BaseModel):
    name: str
    capacity: Optional[int] = None


class ClassroomRead(BaseModel):
    id: int
    name: str
    capacity: Optional[int]

    class Config:
        from_attributes = True