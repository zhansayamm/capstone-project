from datetime import datetime

from pydantic import BaseModel, field_validator

from app.schemas.user import UserMini


class BookingMessageCreate(BaseModel):
    message: str

    @field_validator("message")
    @classmethod
    def validate_message(cls, v: str) -> str:
        v = (v or "").strip()
        if not v:
            raise ValueError("message cannot be empty")
        if len(v) > 2000:
            raise ValueError("message must be at most 2000 characters")
        return v


class BookingMessageRead(BaseModel):
    id: int
    booking_id: int
    sender_id: int
    message: str
    created_at: datetime
    sender: UserMini | None = None

    class Config:
        from_attributes = True

