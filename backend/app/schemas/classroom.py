from typing import Optional

from pydantic import BaseModel, field_validator


class ClassroomCreate(BaseModel):
    name: str
    capacity: int
    university_id: int | None = None

    @field_validator("name")
    @classmethod
    def strip_and_require_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Classroom name cannot be empty")
        return v

    @field_validator("capacity")
    @classmethod
    def validate_capacity(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("Capacity must be greater than 0")
        return v


class ClassroomRead(BaseModel):
    id: int
    university_id: int | None = None
    name: str
    capacity: int

    class Config:
        from_attributes = True


class ClassroomUpdate(BaseModel):
    name: str | None = None
    capacity: int | None = None

    @field_validator("name")
    @classmethod
    def strip_name_optional(cls, v: str | None) -> str | None:
        if v is None:
            return None
        stripped = v.strip()
        if not stripped:
            raise ValueError("Classroom name cannot be empty")
        return stripped

    @field_validator("capacity")
    @classmethod
    def validate_capacity(cls, v: int | None) -> int | None:
        if v is None:
            return v
        if v <= 0:
            raise ValueError("Capacity must be greater than 0")
        return v