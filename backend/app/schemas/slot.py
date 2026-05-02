from pydantic import BaseModel, field_validator
from datetime import datetime, timedelta


class SlotCreate(BaseModel):
    start_time: datetime
    end_time: datetime
    duration_minutes: int = 30
    title: str
    description: str | None = None
    university_id: int | None = None

    @staticmethod
    def _require_utc(dt: datetime) -> datetime:
        if dt.tzinfo is None or dt.utcoffset() is None:
            raise ValueError("Datetime must be timezone-aware (UTC)")
        if dt.utcoffset() != timedelta(0):
            raise ValueError("Datetime must be in UTC (offset 0)")
        return dt

    @field_validator("start_time", "end_time")
    @classmethod
    def validate_datetimes(cls, v: datetime) -> datetime:
        return cls._require_utc(v)

    @field_validator("duration_minutes")
    @classmethod
    def validate_duration_minutes(cls, v: int) -> int:
        if v not in (15, 30, 60):
            raise ValueError("duration_minutes must be one of: 15, 30, 60")
        return v

    @field_validator("title")
    @classmethod
    def validate_title(cls, v: str) -> str:
        v = (v or "").strip()
        if len(v) < 3:
            raise ValueError("title must be at least 3 characters")
        if len(v) > 100:
            raise ValueError("title must be at most 100 characters")
        return v


class SlotRead(BaseModel):
    id: int
    professor_id: int
    university_id: int | None = None
    start_time: datetime
    end_time: datetime
    duration_minutes: int = 30
    title: str
    description: str | None = None
    is_booked: bool
    professor: "UserMini | None" = None
    booked_by: "UserMini | None" = None
    booking_description: str | None = None

    class Config:
        from_attributes = True


from app.schemas.user import UserMini  # noqa: E402