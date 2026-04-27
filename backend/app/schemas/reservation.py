from pydantic import BaseModel
from datetime import datetime


class ReservationCreate(BaseModel):
    classroom_id: int
    start_time: datetime
    end_time: datetime


class ReservationRead(BaseModel):
    id: int
    classroom_id: int
    user_id: int
    start_time: datetime
    end_time: datetime
    created_at: datetime

    class Config:
        from_attributes = True