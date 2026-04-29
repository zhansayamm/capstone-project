from pydantic import BaseModel, field_validator
from datetime import datetime, timedelta


class SlotCreate(BaseModel):
    start_time: datetime
    end_time: datetime
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


class SlotRead(BaseModel):
    id: int
    professor_id: int
    university_id: int | None = None
    start_time: datetime
    end_time: datetime
    is_booked: bool

    class Config:
        from_attributes = True