from pydantic import BaseModel
from datetime import datetime
from app.models.enums import BookingStatus
from typing import Optional
from app.schemas.user import UserMini


class BookingCreate(BaseModel):
    slot_id: int
    description: Optional[str] = None

    @classmethod
    def _clean_desc(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        v = v.strip()
        if not v:
            return None
        if len(v) > 200:
            raise ValueError("description must be at most 200 characters")
        return v

    from pydantic import field_validator  # noqa: E402

    @field_validator("description")
    @classmethod
    def validate_description(cls, v: Optional[str]) -> Optional[str]:
        return cls._clean_desc(v)


class BookingSlotRead(BaseModel):
    professor_id: int
    university_id: int | None = None
    start_time: datetime
    end_time: datetime
    title: str
    description: str | None = None
    professor: UserMini | None = None


class BookingRead(BaseModel):
    id: int
    student_id: int
    slot_id: int
    university_id: int | None = None
    status: BookingStatus
    created_at: datetime
    description: Optional[str] = None
    slot: BookingSlotRead
    queue_position: Optional[int] = None
    student: UserMini | None = None

    class Config:
        from_attributes = True