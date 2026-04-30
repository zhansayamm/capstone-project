from pydantic import BaseModel
from datetime import datetime
from app.models.enums import BookingStatus
from typing import Optional
from app.schemas.user import UserMini


class BookingCreate(BaseModel):
    slot_id: int


class BookingSlotRead(BaseModel):
    professor_id: int
    university_id: int | None = None
    start_time: datetime
    end_time: datetime
    professor: UserMini | None = None


class BookingRead(BaseModel):
    id: int
    student_id: int
    slot_id: int
    university_id: int | None = None
    status: BookingStatus
    created_at: datetime
    slot: BookingSlotRead
    queue_position: Optional[int] = None
    student: UserMini | None = None

    class Config:
        from_attributes = True