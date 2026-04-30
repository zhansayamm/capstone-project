from __future__ import annotations

from datetime import datetime, time, timezone

BUSINESS_START_UTC = time(8, 30)
BUSINESS_END_UTC = time(17, 30)


def ensure_utc(dt: datetime) -> datetime:
    """Return a timezone-aware UTC datetime (naive is treated as UTC)."""
    if dt.tzinfo is None or dt.utcoffset() is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def is_within_business_hours(start: datetime, end: datetime) -> bool:
    """True if start/end are on same UTC date and within 08:30–17:30 UTC."""
    s = ensure_utc(start)
    e = ensure_utc(end)
    if s.date() != e.date():
        return False
    s_time = s.time().replace(tzinfo=None)
    e_time = e.time().replace(tzinfo=None)
    return BUSINESS_START_UTC <= s_time and e_time <= BUSINESS_END_UTC

