from app.core.exceptions import ConflictException, ForbiddenException, NotFoundException
from sqlmodel import Session, select
from datetime import datetime, timezone
import logging

from app.models.booking import Booking
from app.models.slot import Slot
from app.models.user import User
from app.schemas.slot import SlotCreate
from app.utils.datetime_utils import (
    BUSINESS_END_LOCAL,
    BUSINESS_START_LOCAL,
    ensure_utc,
    local_clock_times,
    to_local,
)


logger = logging.getLogger(__name__)

WORK_START = BUSINESS_START_LOCAL
WORK_END = BUSINESS_END_LOCAL


class SlotService:
    @staticmethod
    def _to_read(*, session: Session, slot: Slot) -> dict:
        professor = session.get(User, slot.professor_id)
        return {
            "id": slot.id,
            "professor_id": slot.professor_id,
            "university_id": slot.university_id,
            "start_time": to_local(slot.start_time),
            "end_time": to_local(slot.end_time),
            "is_booked": slot.is_booked,
            "professor": professor,
        }
    @staticmethod
    def create_slot(*, session: Session, professor: User, data: SlotCreate) -> dict:
        if data.start_time.tzinfo is None:
            data.start_time = data.start_time.replace(tzinfo=timezone.utc)
        if data.end_time.tzinfo is None:
            data.end_time = data.end_time.replace(tzinfo=timezone.utc)

        if data.start_time >= data.end_time:
            raise ConflictException("Start time must be before end time")

        local_start, local_end, s_clock, e_clock = local_clock_times(data.start_time, data.end_time)
        logger.info(
            "create_slot: local Start: %s, End: %s (dates %s → %s)",
            s_clock,
            e_clock,
            local_start.date(),
            local_end.date(),
        )

        if local_start.date() != local_end.date():
            raise ConflictException("Slots must be within 08:30–17:30 on the same day")

        if s_clock < WORK_START:
            raise ConflictException("Slots cannot start before 08:30")

        if e_clock > WORK_END:
            raise ConflictException("Slots must end by 17:30")

        now = datetime.now(timezone.utc)
        if data.start_time <= now:
            raise ConflictException("Cannot create a slot in the past")

        existing_slots = session.exec(
            select(Slot).where(Slot.professor_id == professor.id)
        ).all()

        for slot in existing_slots:
            if slot.start_time.tzinfo is None:
                slot.start_time = slot.start_time.replace(tzinfo=timezone.utc)
            if slot.end_time.tzinfo is None:
                slot.end_time = slot.end_time.replace(tzinfo=timezone.utc)
            if not (data.end_time <= slot.start_time or data.start_time >= slot.end_time):
                raise ConflictException("Slot overlaps with existing slot")

        new_slot = Slot(
            professor_id=professor.id,
            university_id=professor.university_id,
            start_time=data.start_time,
            end_time=data.end_time,
            is_booked=False,
        )

        session.add(new_slot)
        session.commit()
        session.refresh(new_slot)
        logger.info("Slot created: id=%s professor_id=%s", new_slot.id, professor.id)
        return SlotService._to_read(session=session, slot=new_slot)

    @staticmethod
    def get_all_slots(*, session: Session) -> list[Slot]:
        return session.exec(select(Slot)).all()

    @staticmethod
    def list_slots(
        *,
        session: Session,
        university_id: int | None = None,
        limit: int = 10,
        offset: int = 0,
        professor_id: int | None = None,
        available: bool | None = None,
        start_time_gte: datetime | None = None,
        end_time_lte: datetime | None = None,
    ) -> list[dict]:
        query = select(Slot)
        if university_id is not None:
            query = query.where(Slot.university_id == university_id)
        logger.info("list_slots: university_id=%s", university_id)
        if professor_id is not None:
            query = query.where(Slot.professor_id == professor_id)
        if available is True:
            query = query.where(Slot.is_booked == False)  # noqa: E712
        if available is False:
            query = query.where(Slot.is_booked == True)  # noqa: E712
        if start_time_gte is not None:
            query = query.where(Slot.start_time >= start_time_gte)
        if end_time_lte is not None:
            query = query.where(Slot.end_time <= end_time_lte)
        results = session.exec(query.offset(offset).limit(limit)).all()
        logger.info("list_slots: returned=%s", len(results))
        return [SlotService._to_read(session=session, slot=s) for s in results]

    @staticmethod
    def get_professor_slots(*, session: Session, professor: User) -> list[dict]:
        rows = session.exec(
            select(Slot).where(
                Slot.professor_id == professor.id, Slot.university_id == professor.university_id
            )
        ).all()
        return [SlotService._to_read(session=session, slot=s) for s in rows]

    @staticmethod
    def delete_slot(*, session: Session, professor: User, slot_id: int) -> None:
        slot = session.get(Slot, slot_id)
        if not slot:
            raise NotFoundException("Slot not found")
        if slot.university_id != professor.university_id:
            raise ForbiddenException("You cannot access slots from another university")
        if slot.professor_id != professor.id:
            raise ForbiddenException("You can only delete your own slots")

        existing_booking = session.exec(select(Booking).where(Booking.slot_id == slot_id)).first()
        if existing_booking:
            raise ConflictException("Cannot delete slot with bookings")

        session.delete(slot)
        session.commit()
