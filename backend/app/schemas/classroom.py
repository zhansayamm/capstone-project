from pydantic import BaseModel, field_validator
from typing import Optional


class ClassroomCreate(BaseModel):
    name: str
    capacity: Optional[int] = None
    university_id: int | None = None

    @field_validator("capacity")
    @classmethod
    def validate_capacity(cls, v: Optional[int]) -> Optional[int]:
        if v is None:
            return v
        if v <= 0:
            raise ValueError("Classroom capacity must be greater than 0")
        return v


class ClassroomRead(BaseModel):
    id: int
    university_id: int | None = None
    name: str
    capacity: Optional[int]

    class Config:
        from_attributes = True