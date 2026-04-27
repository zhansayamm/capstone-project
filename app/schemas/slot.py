from pydantic import BaseModel
from datetime import datetime


class SlotCreate(BaseModel):
    start_time: datetime
    end_time: datetime


class SlotRead(BaseModel):
    id: int
    professor_id: int
    start_time: datetime
    end_time: datetime
    is_booked: bool

    class Config:
        from_attributes = True