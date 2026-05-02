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


def local_clock_times(start: datetime, end: datetime) -> tuple[datetime, datetime, time, time]:
    """
    Local wall times for business rules, with microseconds cleared so that
    end exactly at 17:30:00.xxx does not spuriously exceed time(17, 30).
    """
    s_local = to_local(start)
    e_local = to_local(end)
    s_clock = s_local.time().replace(microsecond=0)
    e_clock = e_local.time().replace(microsecond=0)
    return s_local, e_local, s_clock, e_clock


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def is_within_business_hours(start: datetime, end: datetime) -> bool:
    """True if start/end are on same LOCAL date and within 08:30–17:30 LOCAL (inclusive)."""
    s_local, e_local, s_clock, e_clock = local_clock_times(start, end)
    if s_local.date() != e_local.date():
        return False
    return BUSINESS_START_LOCAL <= s_clock and e_clock <= BUSINESS_END_LOCAL

