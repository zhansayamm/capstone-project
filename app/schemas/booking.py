from pydantic import BaseModel
from datetime import datetime
from app.models.enums import BookingStatus


class BookingCreate(BaseModel):
    slot_id: int


class BookingRead(BaseModel):
    id: int
    student_id: int
    slot_id: int
    status: BookingStatus
    created_at: datetime

    class Config:
        from_attributes = True