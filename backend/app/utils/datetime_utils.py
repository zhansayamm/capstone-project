from __future__ import annotations

from datetime import datetime, time, timezone
from zoneinfo import ZoneInfo

LOCAL_TZ = ZoneInfo("Asia/Almaty")

# Working hours are defined in LOCAL time.
BUSINESS_START_LOCAL = time(8, 30)
BUSINESS_END_LOCAL = time(17, 30)


def ensure_utc(dt: datetime) -> datetime:
    """Return a timezone-aware UTC datetime (naive is treated as UTC)."""
    if dt.tzinfo is None or dt.utcoffset() is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)

def to_local(dt: datetime) -> datetime:
    """Convert an input datetime (treated as UTC if naive) to LOCAL_TZ."""
    return ensure_utc(dt).astimezone(LOCAL_TZ)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def is_within_business_hours(start: datetime, end: datetime) -> bool:
    """True if start/end are on same LOCAL date and within 08:30–17:30 LOCAL."""
    s = to_local(start)
    e = to_local(end)
    if s.date() != e.date():
        return False
    s_time = s.time().replace(tzinfo=None)
    e_time = e.time().replace(tzinfo=None)
    return BUSINESS_START_LOCAL <= s_time and e_time <= BUSINESS_END_LOCAL

