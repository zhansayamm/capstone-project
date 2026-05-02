"""Lightweight schemas for calendar month view + day drill-down."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.user import UserMini


class DayPreviewItem(BaseModel):
    title: str
    time: str = Field(description="HH:mm in institution local timezone (group min start when grouped)")
    kind: str
    time_end: str | None = Field(default=None, description="HH:mm local max end (professor month groups)")
    booked: int | None = Field(default=None, description="Approved+booked count across grouped slots")
    capacity: int | None = Field(default=None, description="Summed seat capacity across grouped slots")
    usage_band: str | None = Field(default=None, description="green|orange|red professor capacity hint")


class DaySummary(BaseModel):
    preview: list[DayPreviewItem] = Field(default_factory=list)
    more_count: int = 0
    state: str = Field(description="Professor/Admin: green|orange|red|gray · Student: blue|purple|green|mixed|gray")


class MonthSummaryResponse(BaseModel):
    year: int
    month: int
    days: dict[str, DaySummary]


class CalendarDayBookingRow(BaseModel):
    booking_id: int | None = None
    student: UserMini | None = None
    professor: UserMini | None = None
    time_range: str
    status: str
    description: str | None = None
    slot_id: int | None = None


class CalendarDayGroup(BaseModel):
    slot_title: str
    slot_description: str | None = None
    date: str
    booking_count: int
    bookings: list[CalendarDayBookingRow]


class StudentReservationDetail(BaseModel):
    classroom_name: str
    time_range: str
    created_at: datetime | None = None

    class Config:
        from_attributes = False


class DayDetailsResponse(BaseModel):
    date: str
    groups: list[CalendarDayGroup] = Field(default_factory=list)
    student_bookings: list[CalendarDayGroup] | None = None
    student_reservations: list[StudentReservationDetail] | None = None
    student_available_slots: list[CalendarDayGroup] | None = None


class WeekCalendarEvent(BaseModel):
    """Timed event for week grid (institution LOCAL_TZ wall date on `date`)."""

    date: str = Field(description="YYYY-MM-DD local calendar day containing start")
    title: str
    kind: str = Field(description="booking|reservation|slot (student); slot_booked|slot_free (prof); slot_full|slot_open (admin)")
    start: datetime = Field(description="UTC instant (tz-aware)")
    end: datetime = Field(description="UTC instant (tz-aware)")


class WeekSummaryResponse(BaseModel):
    week_start: str = Field(description="Monday YYYY-MM-DD in LOCAL_TZ")
    events: list[WeekCalendarEvent] = Field(default_factory=list)
