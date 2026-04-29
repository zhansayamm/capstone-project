"""ICS calendar generation (UTC, Google Calendar–compatible)."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone


def _to_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def format_ics_utc(dt: datetime) -> str:
    """Format as YYYYMMDDTHHMMSSZ in UTC."""
    return _to_utc(dt).strftime("%Y%m%dT%H%M%SZ")


def _escape_ics_text(text: str) -> str:
    return (
        text.replace("\\", "\\\\")
        .replace("\n", "\\n")
        .replace("\r", "")
        .replace(",", "\\,")
        .replace(";", "\\;")
    )


def generate_ics(events: list) -> str:
    """
    Build a minimal VCALENDAR string.

    Each event dict may contain:
    - dtstart, dtend: datetime (naive treated as UTC)
    - summary: str
    - uid: optional str (unique per event)
    """
    lines: list[str] = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//PMBooking//Calendar//EN",
        "CALSCALE:GREGORIAN",
    ]
    stamp = format_ics_utc(datetime.now(timezone.utc))
    for i, ev in enumerate(events):
        dtstart = ev["dtstart"]
        dtend = ev["dtend"]
        summary = _escape_ics_text(str(ev.get("summary", "Event")))
        uid = ev.get("uid") or f"evt-{i}-{uuid.uuid4()}@pmbooking"
        lines.extend(
            [
                "BEGIN:VEVENT",
                f"UID:{uid}",
                f"DTSTAMP:{stamp}",
                f"DTSTART:{format_ics_utc(dtstart)}",
                f"DTEND:{format_ics_utc(dtend)}",
                f"SUMMARY:{summary}",
                "END:VEVENT",
            ]
        )
    lines.append("END:VCALENDAR")
    return "\r\n".join(lines) + "\r\n"
