"""Month calendar summaries and per-day grouped details (local institution timezone)."""

from __future__ import annotations

from collections import defaultdict
from collections.abc import Iterable
from datetime import date, datetime, timedelta, timezone
from typing import TypedDict

from sqlalchemy import func, or_
from sqlmodel import Session, select

from app.models.booking import Booking
from app.models.classroom import Classroom
from app.models.enums import BookingStatus
from app.models.reservation import Reservation
from app.models.slot import Slot
from app.models.user import User
from app.schemas.calendar_month import (
    CalendarDayBookingRow,
    CalendarDayGroup,
    DayDetailsResponse,
    DayPreviewItem,
    DaySummary,
    MonthSummaryResponse,
    StudentReservationDetail,
    WeekCalendarEvent,
    WeekSummaryResponse,
)
from app.schemas.user import UserMini
from app.utils.datetime_utils import LOCAL_TZ, ensure_utc, to_local


def _norm_booking_status(s: BookingStatus) -> BookingStatus:
    if s == BookingStatus.booked:
        return BookingStatus.approved
    if s == BookingStatus.queued:
        return BookingStatus.pending
    return s


def _student_blocks_slot_for_available_preview(booking: Booking) -> bool:
    """Treat pending/active bookings as reserving the student's interest in this slot overlay."""
    s = _norm_booking_status(booking.status)
    return s in (
        BookingStatus.pending,
        BookingStatus.approved,
        BookingStatus.booked,
        BookingStatus.queued,
    )


def _slot_capacity_open(*, slot: Slot, approved_count: int) -> bool:
    cap = int(getattr(slot, "capacity", 1) or 1)
    if getattr(slot, "is_booked", False):
        return False
    return approved_count < cap


def _merge_student_days(days_preview: defaultdict[str, list[DayPreviewItem]]) -> dict[str, DaySummary]:
    out: dict[str, DaySummary] = {}
    for dkey, previews in days_preview.items():
        previews_sorted = sorted(previews, key=lambda p: (p.time, p.title))
        shown = previews_sorted[:3]
        more_count = max(0, len(previews_sorted) - 3)
        kinds = {p.kind for p in previews_sorted}
        if not previews_sorted:
            state = "gray"
        elif kinds <= {"booking"}:
            state = "blue"
        elif kinds <= {"reservation"}:
            state = "purple"
        elif kinds <= {"slot"}:
            state = "green"
        elif "booking" in kinds and "reservation" in kinds and "slot" not in kinds:
            state = "mixed"
        elif "slot" in kinds and len(kinds) > 1:
            state = "mixed"
        else:
            state = "mixed"

        out[dkey] = DaySummary(preview=shown, more_count=more_count, state=state)
    return out


def _week_bounds_utc_from_monday(monday_local: date) -> tuple[datetime, datetime]:
    start_local = datetime(monday_local.year, monday_local.month, monday_local.day, 0, 0, 0, tzinfo=LOCAL_TZ)
    end_local = start_local + timedelta(days=7)
    return start_local.astimezone(timezone.utc), end_local.astimezone(timezone.utc)


def _normalize_week_start_monday(d: date) -> date:
    return d - timedelta(days=d.weekday())


def _month_range_utc(*, year: int, month: int) -> tuple[datetime, datetime]:
    """[start_utc, end_utc_exclusive) covering full calendar month in LOCAL_TZ."""
    start_local = datetime(year, month, 1, 0, 0, 0, tzinfo=LOCAL_TZ)
    if month == 12:
        end_local_excl = datetime(year + 1, 1, 1, 0, 0, 0, tzinfo=LOCAL_TZ)
    else:
        end_local_excl = datetime(year, month + 1, 1, 0, 0, 0, tzinfo=LOCAL_TZ)
    return start_local.astimezone(timezone.utc), end_local_excl.astimezone(timezone.utc)


def _local_date_str(dt_utc_naive_ok: datetime) -> str:
    return to_local(dt_utc_naive_ok).strftime("%Y-%m-%d")


def _hhmm(dt_utc_naive_ok: datetime) -> str:
    return to_local(dt_utc_naive_ok).strftime("%H:%M")


def _time_range(slot: Slot) -> str:
    return f"{_hhmm(slot.start_time)}–{_hhmm(slot.end_time)}"


class _AggDay(TypedDict):
    previews: list[DayPreviewItem]
    slots_any: bool
    slots_all_full: bool
    slots_some_full: bool
    slots_some_free: bool
    bookings_any: bool
    pending_student: bool


def _professor_usage_band(booked: int, capacity: int) -> str:
    if capacity <= 0:
        return "orange"
    r = booked / capacity
    if booked >= capacity or r >= 0.999:
        return "red"
    if r >= 0.35:
        return "orange"
    return "green"


def _merge_previews(days: dict[str, _AggDay], *, preview_limit: int = 3) -> dict[str, DaySummary]:
    out: dict[str, DaySummary] = {}
    for dkey, agg in days.items():
        previews = sorted(agg["previews"], key=lambda p: (p.time, p.title))
        shown = previews[:preview_limit]
        more_count = max(0, len(previews) - preview_limit)
        st = agg
        if not previews:
            state = "gray"
        elif not st["slots_any"]:
            state = "orange"
        elif st["slots_all_full"] and not st["slots_some_free"]:
            state = "red"
        elif st["slots_some_full"] and st["slots_some_free"]:
            state = "orange"
        elif st["slots_some_free"]:
            if st["pending_student"] or st["bookings_any"]:
                state = "orange"
            else:
                state = "green"
        else:
            state = "orange"

        out[dkey] = DaySummary(preview=shown, more_count=more_count, state=state)
    return out


def _approved_booking_counts(session: Session, slot_ids: Iterable[int]) -> dict[int, int]:
    ids = list(slot_ids)
    if not ids:
        return {}
    rows = session.exec(
        select(Booking.slot_id, func.count(Booking.id))
        .where(
            Booking.slot_id.in_(ids),
            or_(Booking.status == BookingStatus.approved, Booking.status == BookingStatus.booked),
        )
        .group_by(Booking.slot_id)
    ).all()
    return {int(sid): int(c) for sid, c in rows}


class CalendarMonthService:
    @staticmethod
    def normalize_week_start_monday(d: date) -> date:
        return _normalize_week_start_monday(d)

    @staticmethod
    def student_week_summary(
        *,
        session: Session,
        student: User,
        week_start_local: date,
        include_bookings: bool = True,
        include_available_slots: bool = False,
    ) -> WeekSummaryResponse:
        monday = _normalize_week_start_monday(week_start_local)
        start_u, end_u = _week_bounds_utc_from_monday(monday)
        events: list[WeekCalendarEvent] = []

        bookings_rows: list[tuple[Booking, Slot]] = []
        if include_bookings:
            bookings_rows = list(
                session.exec(
                    select(Booking, Slot)
                    .join(Slot)
                    .where(
                        Booking.student_id == student.id,
                        Booking.university_id == student.university_id,
                        Slot.start_time >= start_u,
                        Slot.start_time < end_u,
                    )
                ).all()
            )

        res_rows = list(
            session.exec(
                select(Reservation, Classroom)
                .join(Classroom, Classroom.id == Reservation.classroom_id)
                .where(
                    Reservation.user_id == student.id,
                    Reservation.university_id == student.university_id,
                    Reservation.start_time >= start_u,
                    Reservation.start_time < end_u,
                )
            ).all()
        )

        blocked_slot_ids: set[int] = set()
        for booking, slot in bookings_rows:
            if _student_blocks_slot_for_available_preview(booking) and slot.id is not None:
                blocked_slot_ids.add(int(slot.id))

        if include_bookings:
            for _booking, slot in sorted(bookings_rows, key=lambda x: ensure_utc(x[1].start_time)):
                title = (slot.title or "General").strip() or "General"
                st = ensure_utc(slot.start_time)
                en = ensure_utc(slot.end_time)
                events.append(
                    WeekCalendarEvent(
                        date=_local_date_str(slot.start_time),
                        title=title,
                        kind="booking",
                        start=st,
                        end=en,
                    )
                )

        for res, classroom in sorted(res_rows, key=lambda x: ensure_utc(x[0].start_time)):
            st = ensure_utc(res.start_time)
            en = ensure_utc(res.end_time)
            events.append(
                WeekCalendarEvent(
                    date=_local_date_str(res.start_time),
                    title=classroom.name,
                    kind="reservation",
                    start=st,
                    end=en,
                )
            )

        if include_available_slots:
            slots = session.exec(
                select(Slot).where(
                    Slot.university_id == student.university_id,
                    Slot.start_time >= start_u,
                    Slot.start_time < end_u,
                )
            ).all()
            slot_ids = [s.id for s in slots if s.id]
            counts = _approved_booking_counts(session, slot_ids)
            for s in sorted(slots, key=lambda x: x.start_time):
                if s.id is not None and int(s.id) in blocked_slot_ids:
                    continue
                approved_n = counts.get(int(s.id or 0), 0)
                if not _slot_capacity_open(slot=s, approved_count=approved_n):
                    continue
                title = (s.title or "General").strip() or "General"
                st_t = ensure_utc(s.start_time)
                en_t = ensure_utc(s.end_time)
                events.append(
                    WeekCalendarEvent(
                        date=_local_date_str(s.start_time),
                        title=title,
                        kind="slot",
                        start=st_t,
                        end=en_t,
                    )
                )

        events.sort(key=lambda e: ensure_utc(e.start))
        return WeekSummaryResponse(week_start=monday.isoformat(), events=events)

    @staticmethod
    def professor_week_summary(*, session: Session, professor: User, week_start_local: date) -> WeekSummaryResponse:
        monday = _normalize_week_start_monday(week_start_local)
        start_u, end_u = _week_bounds_utc_from_monday(monday)
        slots = session.exec(
            select(Slot).where(
                Slot.professor_id == professor.id,
                Slot.university_id == professor.university_id,
                Slot.start_time >= start_u,
                Slot.start_time < end_u,
            )
        ).all()
        slot_ids = [s.id for s in slots if s.id]
        counts = _approved_booking_counts(session, slot_ids)
        capacity_by_id = {s.id: int(getattr(s, "capacity", 1) or 1) for s in slots if s.id}

        events: list[WeekCalendarEvent] = []
        for s in sorted(slots, key=lambda x: x.start_time):
            cap = capacity_by_id.get(s.id or 0, 1)
            approved_n = counts.get(s.id or 0, 0)
            slot_full_db = getattr(s, "is_booked", False) or approved_n >= cap
            title = (s.title or "General").strip() or "General"
            kind = "slot_booked" if slot_full_db else "slot_free"
            events.append(
                WeekCalendarEvent(
                    date=_local_date_str(s.start_time),
                    title=title,
                    kind=kind,
                    start=ensure_utc(s.start_time),
                    end=ensure_utc(s.end_time),
                )
            )

        events.sort(key=lambda e: ensure_utc(e.start))
        return WeekSummaryResponse(week_start=monday.isoformat(), events=events)

    @staticmethod
    def admin_week_summary(*, session: Session, admin: User, week_start_local: date) -> WeekSummaryResponse:
        monday = _normalize_week_start_monday(week_start_local)
        start_u, end_u = _week_bounds_utc_from_monday(monday)
        uid = admin.university_id
        slots = session.exec(
            select(Slot).where(
                Slot.university_id == uid,
                Slot.start_time >= start_u,
                Slot.start_time < end_u,
            )
        ).all()
        slot_ids = [s.id for s in slots if s.id]
        counts = _approved_booking_counts(session, slot_ids)
        capacity_by_id = {s.id: int(getattr(s, "capacity", 1) or 1) for s in slots if s.id}

        events: list[WeekCalendarEvent] = []
        for s in sorted(slots, key=lambda x: x.start_time):
            cap = capacity_by_id.get(s.id or 0, 1)
            approved_n = counts.get(s.id or 0, 0)
            slot_full = getattr(s, "is_booked", False) or approved_n >= cap
            title = (s.title or "General").strip() or "General"
            kind = "slot_full" if slot_full else "slot_open"
            events.append(
                WeekCalendarEvent(
                    date=_local_date_str(s.start_time),
                    title=title,
                    kind=kind,
                    start=ensure_utc(s.start_time),
                    end=ensure_utc(s.end_time),
                )
            )

        events.sort(key=lambda e: ensure_utc(e.start))
        return WeekSummaryResponse(week_start=monday.isoformat(), events=events)

    @staticmethod
    def professor_month_summary(*, session: Session, professor: User, year: int, month: int) -> MonthSummaryResponse:
        start_u, end_u = _month_range_utc(year=year, month=month)
        slots = session.exec(
            select(Slot).where(
                Slot.professor_id == professor.id,
                Slot.university_id == professor.university_id,
                Slot.start_time >= start_u,
                Slot.start_time < end_u,
            )
        ).all()

        days: defaultdict[str, _AggDay] = defaultdict(
            lambda: {
                "previews": [],
                "slots_any": False,
                "slots_all_full": True,
                "slots_some_full": False,
                "slots_some_free": False,
                "bookings_any": False,
                "pending_student": False,
            }
        )

        counts = _approved_booking_counts(session, [s.id for s in slots if s.id is not None])
        capacity_by_id = {s.id: int(getattr(s, "capacity", 1) or 1) for s in slots if s.id}

        for s in sorted(slots, key=lambda x: x.start_time):
            dkey = _local_date_str(s.start_time)
            a = days[dkey]
            a["slots_any"] = True
            cap = capacity_by_id.get(s.id or 0, 1)
            approved_n = counts.get(s.id or 0, 0)
            slot_full_db = getattr(s, "is_booked", False) or approved_n >= cap
            if slot_full_db:
                a["slots_some_full"] = True
                a["slots_all_full"] = a["slots_all_full"] and True
                a["slots_some_free"] = a["slots_some_free"] or False
            else:
                a["slots_some_free"] = True
                a["slots_all_full"] = False
            if approved_n > 0:
                a["bookings_any"] = True

        groups: defaultdict[tuple[str, str], list[Slot]] = defaultdict(list)
        for s in slots:
            dkey = _local_date_str(s.start_time)
            tnorm = (s.title or "General").strip() or "General"
            groups[(dkey, tnorm)].append(s)

        for (dkey, tnorm), grp in groups.items():
            grp_sorted = sorted(grp, key=lambda x: ensure_utc(x.start_time))
            s0 = grp_sorted[0]
            slot_max_end = max(grp_sorted, key=lambda s1: ensure_utc(s1.end_time))
            booked_sum = sum(counts.get(s1.id or 0, 0) for s1 in grp_sorted)
            cap_sum = sum(capacity_by_id.get(s1.id or 0, 1) for s1 in grp_sorted)
            band = _professor_usage_band(booked_sum, cap_sum)
            drow = days[dkey]
            drow["previews"].append(
                DayPreviewItem(
                    title=tnorm,
                    time=_hhmm(s0.start_time),
                    time_end=_hhmm(slot_max_end.end_time),
                    kind="prof_slot_group",
                    booked=booked_sum,
                    capacity=cap_sum,
                    usage_band=band,
                ),
            )

        return MonthSummaryResponse(year=year, month=month, days=_merge_previews(days, preview_limit=2))

    @staticmethod
    def student_month_summary(
        *,
        session: Session,
        student: User,
        year: int,
        month: int,
        include_bookings: bool = True,
        include_available_slots: bool = False,
    ) -> MonthSummaryResponse:
        start_u, end_u = _month_range_utc(year=year, month=month)
        previews_by_day: defaultdict[str, list[DayPreviewItem]] = defaultdict(list)

        bookings_rows: list[tuple[Booking, Slot]] = []
        if include_bookings:
            bookings_rows = list(
                session.exec(
                    select(Booking, Slot)
                    .join(Slot)
                    .where(
                        Booking.student_id == student.id,
                        Booking.university_id == student.university_id,
                        Slot.start_time >= start_u,
                        Slot.start_time < end_u,
                    )
                ).all()
            )

        res_rows = list(
            session.exec(
                select(Reservation, Classroom)
                .join(Classroom, Classroom.id == Reservation.classroom_id)
                .where(
                    Reservation.user_id == student.id,
                    Reservation.university_id == student.university_id,
                    Reservation.start_time >= start_u,
                    Reservation.start_time < end_u,
                )
            ).all()
        )

        blocked_slot_ids: set[int] = set()
        for booking, slot in bookings_rows:
            if _student_blocks_slot_for_available_preview(booking) and slot.id is not None:
                blocked_slot_ids.add(int(slot.id))

        if include_bookings:
            for booking, slot in bookings_rows:
                dkey = _local_date_str(slot.start_time)
                title = (slot.title or "General").strip() or "General"
                tm = _hhmm(slot.start_time)
                previews_by_day[dkey].append(
                    DayPreviewItem(title=f"{title} — {tm}", time=tm, kind="booking"),
                )

        for res, classroom in res_rows:
            dkey = _local_date_str(res.start_time)
            tm = _hhmm(res.start_time)
            previews_by_day[dkey].append(
                DayPreviewItem(title=f"{classroom.name} — {tm}", time=tm, kind="reservation"),
            )

        if include_available_slots:
            slots = session.exec(
                select(Slot).where(
                    Slot.university_id == student.university_id,
                    Slot.start_time >= start_u,
                    Slot.start_time < end_u,
                )
            ).all()
            slot_ids = [s.id for s in slots if s.id]
            counts = _approved_booking_counts(session, slot_ids)
            for s in sorted(slots, key=lambda x: x.start_time):
                if s.id is not None and int(s.id) in blocked_slot_ids:
                    continue
                approved_n = counts.get(int(s.id or 0), 0)
                if not _slot_capacity_open(slot=s, approved_count=approved_n):
                    continue
                title = (s.title or "General").strip() or "General"
                tm = _hhmm(s.start_time)
                dkey = _local_date_str(s.start_time)
                previews_by_day[dkey].append(DayPreviewItem(title=f"{title} — {tm}", time=tm, kind="slot"))

        merged = _merge_student_days(previews_by_day)
        return MonthSummaryResponse(year=year, month=month, days=merged)

    @staticmethod
    def admin_month_summary(*, session: Session, admin: User, year: int, month: int) -> MonthSummaryResponse:
        start_u, end_u = _month_range_utc(year=year, month=month)
        uid = admin.university_id

        slots = session.exec(
            select(Slot).where(
                Slot.university_id == uid,
                Slot.start_time >= start_u,
                Slot.start_time < end_u,
            )
        ).all()

        bookings = session.exec(
            select(Booking, Slot)
            .join(Slot)
            .where(Booking.university_id == uid, Slot.start_time >= start_u, Slot.start_time < end_u)
        ).all()

        days: defaultdict[str, _AggDay] = defaultdict(
            lambda: {
                "previews": [],
                "slots_any": False,
                "slots_all_full": True,
                "slots_some_full": False,
                "slots_some_free": False,
                "bookings_any": False,
                "pending_student": False,
            }
        )

        slot_ids = [s.id for s in slots if s.id]
        counts = _approved_booking_counts(session, slot_ids)
        capacity_by_id = {s.id: int(getattr(s, "capacity", 1) or 1) for s in slots if s.id}

        for s in sorted(slots, key=lambda x: x.start_time):
            dkey = _local_date_str(s.start_time)
            a = days[dkey]
            a["slots_any"] = True
            cap = capacity_by_id.get(s.id or 0, 1)
            approved_n = counts.get(s.id or 0, 0)
            slot_full = getattr(s, "is_booked", False) or approved_n >= cap
            title = (s.title or "General").strip() or "General"
            tm = _hhmm(s.start_time)
            if slot_full:
                a["slots_some_full"] = True
                a["previews"].append(DayPreviewItem(title=title, time=tm, kind="slot_full"))
            else:
                a["slots_some_free"] = True
                a["slots_all_full"] = False
                a["previews"].append(DayPreviewItem(title=title, time=tm, kind="slot_open"))

        for booking, slot in bookings:
            dkey = _local_date_str(slot.start_time)
            a = days[dkey]
            a["bookings_any"] = True
            ns = _norm_booking_status(booking.status)
            if ns == BookingStatus.pending:
                a["pending_student"] = True
            student = session.get(User, booking.student_id)
            em = str(student.email) if student else ""
            st_lbl = (em[:20] + "…") if len(em) > 20 else em or f"student #{booking.student_id}"
            title = (slot.title or "General").strip() or "General"
            tm = _hhmm(slot.start_time)
            kind = "booking_pending" if ns == BookingStatus.pending else "booking_other"
            a["previews"].append(DayPreviewItem(title=f"{title} · {st_lbl}", time=tm, kind=kind))

        return MonthSummaryResponse(year=year, month=month, days=_merge_previews(days))

    # ---- day drill-down -------------------------------------------------

    @staticmethod
    def _group_sort_key(slot: Slot) -> tuple[int, datetime]:
        return (slot.id or 0, ensure_utc(slot.start_time))

    @staticmethod
    def professor_day_details(*, session: Session, professor: User, day: date) -> DayDetailsResponse:
        start_local = datetime(day.year, day.month, day.day, 0, 0, 0, tzinfo=LOCAL_TZ)
        end_local = start_local + timedelta(days=1)
        start_u, end_u = start_local.astimezone(timezone.utc), end_local.astimezone(timezone.utc)

        slots = session.exec(
            select(Slot).where(
                Slot.professor_id == professor.id,
                Slot.university_id == professor.university_id,
                Slot.start_time >= start_u,
                Slot.start_time < end_u,
            )
        ).all()

        if not slots:
            return DayDetailsResponse(date=day.isoformat(), groups=[])

        slot_ids = [s.id for s in slots if s.id]
        bookings_all = session.exec(select(Booking).where(Booking.slot_id.in_(slot_ids))).all()
        bookings_by_slot: dict[int, list[Booking]] = defaultdict(list)
        for b in bookings_all:
            bookings_by_slot[int(b.slot_id)].append(b)
        groups_map: dict[tuple[str, str], CalendarDayGroup] = {}
        ordered_keys: list[tuple[str, str]] = []

        for s in sorted(slots, key=CalendarMonthService._group_sort_key):
            title = (s.title or "General").strip() or "General"
            dkey = day.isoformat()
            gkey = (title, dkey)
            if gkey not in groups_map:
                groups_map[gkey] = CalendarDayGroup(
                    slot_title=title,
                    slot_description=s.description,
                    date=dkey,
                    booking_count=0,
                    bookings=[],
                )
                ordered_keys.append(gkey)
            grp = groups_map[gkey]

            bookings_here = bookings_by_slot.get(s.id or 0, [])
            bookings_here = sorted(bookings_here, key=lambda b: ensure_utc(b.created_at))

            if not bookings_here:
                grp.bookings.append(
                    CalendarDayBookingRow(
                        booking_id=None,
                        student=None,
                        time_range=_time_range(s),
                        status="available",
                        description=None,
                        slot_id=s.id,
                    )
                )
            else:
                for b in bookings_here:
                    stu = session.get(User, b.student_id)
                    mini = UserMini.model_validate(stu) if stu else None
                    grp.bookings.append(
                        CalendarDayBookingRow(
                            booking_id=b.id,
                            student=mini,
                            time_range=_time_range(s),
                            status=_norm_booking_status(b.status).value,
                            description=b.description,
                            slot_id=s.id,
                        )
                    )

        groups = [groups_map[k] for k in ordered_keys]
        CalendarMonthService._recompute_booking_counts(groups)
        return DayDetailsResponse(date=day.isoformat(), groups=groups)

    @staticmethod
    def _recompute_booking_counts(groups: list[CalendarDayGroup]) -> None:
        for g in groups:
            n_booked = sum(1 for x in g.bookings if x.booking_id is not None)
            g.booking_count = n_booked if n_booked else len(g.bookings)

    @staticmethod
    def student_day_details(
        *,
        session: Session,
        student: User,
        day: date,
        include_bookings: bool = True,
        include_available_slots: bool = False,
    ) -> DayDetailsResponse:
        start_local = datetime(day.year, day.month, day.day, 0, 0, 0, tzinfo=LOCAL_TZ)
        end_local = start_local + timedelta(days=1)
        start_u, end_u = start_local.astimezone(timezone.utc), end_local.astimezone(timezone.utc)
        day_str = day.isoformat()

        my_bookings_raw = session.exec(
            select(Booking, Slot)
            .join(Slot)
            .where(
                Booking.student_id == student.id,
                Booking.university_id == student.university_id,
                Slot.start_time >= start_u,
                Slot.start_time < end_u,
            )
        ).all()

        blocked_slot_ids: set[int] = set()
        for booking, slot in my_bookings_raw:
            if _student_blocks_slot_for_available_preview(booking) and slot.id is not None:
                blocked_slot_ids.add(int(slot.id))

        student_bookings: list[CalendarDayGroup] = []
        if include_bookings:
            bookings_by_group: dict[tuple[str, str], CalendarDayGroup] = {}
            order_b: list[tuple[str, str]] = []
            for booking, slot in sorted(my_bookings_raw, key=lambda x: ensure_utc(x[0].created_at)):
                title = (slot.title or "General").strip() or "General"
                gkey = (title, day_str)
                if gkey not in bookings_by_group:
                    bookings_by_group[gkey] = CalendarDayGroup(
                        slot_title=title,
                        slot_description=slot.description,
                        date=day_str,
                        booking_count=0,
                        bookings=[],
                    )
                    order_b.append(gkey)
                prof = session.get(User, slot.professor_id)
                prof_mini = UserMini.model_validate(prof) if prof else None
                bookings_by_group[gkey].bookings.append(
                    CalendarDayBookingRow(
                        booking_id=booking.id,
                        professor=prof_mini,
                        student=None,
                        time_range=_time_range(slot),
                        status=_norm_booking_status(booking.status).value,
                        description=booking.description,
                        slot_id=slot.id,
                    )
                )
            student_bookings = [bookings_by_group[k] for k in order_b]
            CalendarMonthService._recompute_booking_counts(student_bookings)

        res_rows = session.exec(
            select(Reservation, Classroom)
            .join(Classroom, Classroom.id == Reservation.classroom_id)
            .where(
                Reservation.user_id == student.id,
                Reservation.university_id == student.university_id,
                Reservation.start_time >= start_u,
                Reservation.start_time < end_u,
            )
        ).all()

        student_reservations = [
            StudentReservationDetail(
                classroom_name=classroom.name,
                time_range=f"{_hhmm(res.start_time)}–{_hhmm(res.end_time)}",
                created_at=to_local(res.created_at),
            )
            for res, classroom in res_rows
        ]

        student_available_slots: list[CalendarDayGroup] | None = None
        if include_available_slots:
            slots = session.exec(
                select(Slot).where(
                    Slot.university_id == student.university_id,
                    Slot.start_time >= start_u,
                    Slot.start_time < end_u,
                )
            ).all()
            slot_ids = [s.id for s in slots if s.id]
            counts = _approved_booking_counts(session, slot_ids)
            avail_map: dict[tuple[str, str], CalendarDayGroup] = {}
            order_a: list[tuple[str, str]] = []
            for s in sorted(slots, key=CalendarMonthService._group_sort_key):
                if s.id is not None and int(s.id) in blocked_slot_ids:
                    continue
                approved_n = counts.get(int(s.id or 0), 0)
                if not _slot_capacity_open(slot=s, approved_count=approved_n):
                    continue
                title = (s.title or "General").strip() or "General"
                gkey = (title, day_str)
                if gkey not in avail_map:
                    avail_map[gkey] = CalendarDayGroup(
                        slot_title=title,
                        slot_description=s.description,
                        date=day_str,
                        booking_count=0,
                        bookings=[],
                    )
                    order_a.append(gkey)
                prof = session.get(User, s.professor_id)
                prof_mini = UserMini.model_validate(prof) if prof else None
                avail_map[gkey].bookings.append(
                    CalendarDayBookingRow(
                        booking_id=None,
                        professor=prof_mini,
                        student=None,
                        time_range=_time_range(s),
                        status="available",
                        description=s.description,
                        slot_id=s.id,
                    )
                )
            student_available_slots = [avail_map[k] for k in order_a]
            CalendarMonthService._recompute_booking_counts(student_available_slots)

        return DayDetailsResponse(
            date=day_str,
            groups=[],
            student_bookings=student_bookings if include_bookings else [],
            student_reservations=student_reservations,
            student_available_slots=student_available_slots,
        )

    @staticmethod
    def admin_day_details(*, session: Session, admin: User, day: date) -> DayDetailsResponse:
        start_local = datetime(day.year, day.month, day.day, 0, 0, 0, tzinfo=LOCAL_TZ)
        end_local = start_local + timedelta(days=1)
        start_u, end_u = start_local.astimezone(timezone.utc), end_local.astimezone(timezone.utc)
        uid = admin.university_id

        slots = session.exec(
            select(Slot).where(
                Slot.university_id == uid,
                Slot.start_time >= start_u,
                Slot.start_time < end_u,
            )
        ).all()

        rows = session.exec(
            select(Booking, Slot)
            .join(Slot)
            .where(Booking.university_id == uid, Slot.start_time >= start_u, Slot.start_time < end_u)
        ).all()

        bookings_by_slot: dict[int, list[Booking]] = defaultdict(list)
        for b, _sl in rows:
            bookings_by_slot[int(b.slot_id)].append(b)

        groups_map: dict[tuple[str, str], CalendarDayGroup] = {}
        ordered_keys: list[tuple[str, str]] = []

        for s in sorted(slots, key=CalendarMonthService._group_sort_key):
            title = (s.title or "General").strip() or "General"
            dkey = day.isoformat()
            gkey = (title, dkey)
            if gkey not in groups_map:
                groups_map[gkey] = CalendarDayGroup(
                    slot_title=title,
                    slot_description=s.description,
                    date=dkey,
                    booking_count=0,
                    bookings=[],
                )
                ordered_keys.append(gkey)
            grp = groups_map[gkey]
            here = bookings_by_slot.get(s.id or 0, [])
            if not here:
                grp.bookings.append(
                    CalendarDayBookingRow(
                        booking_id=None,
                        student=None,
                        time_range=_time_range(s),
                        status="available",
                        description=None,
                        slot_id=s.id,
                    )
                )
            else:
                for b in sorted(here, key=lambda x: ensure_utc(x.created_at)):
                    stu = session.get(User, b.student_id)
                    mini = UserMini.model_validate(stu) if stu else None
                    grp.bookings.append(
                        CalendarDayBookingRow(
                            booking_id=b.id,
                            student=mini,
                            time_range=_time_range(s),
                            status=_norm_booking_status(b.status).value,
                            description=b.description,
                            slot_id=s.id,
                        )
                    )

        groups = [groups_map[k] for k in ordered_keys]
        CalendarMonthService._recompute_booking_counts(groups)
        return DayDetailsResponse(date=day.isoformat(), groups=groups)
