from fastapi import HTTPException
from sqlmodel import Session, select

from app.models.booking import Booking
from app.models.enums import BookingStatus
from app.models.slot import Slot
from app.models.user import User
from app.schemas.slot import SlotCreate


class SlotService:
    @staticmethod
    def create_slot(*, session: Session, professor: User, data: SlotCreate) -> Slot:
        if data.start_time >= data.end_time:
            raise HTTPException(status_code=400, detail="Start time must be before end time")

        existing_slots = session.exec(
            select(Slot).where(Slot.professor_id == professor.id)
        ).all()

        for slot in existing_slots:
            if not (data.end_time <= slot.start_time or data.start_time >= slot.end_time):
                raise HTTPException(status_code=400, detail="Slot overlaps with existing slot")

        new_slot = Slot(
            professor_id=professor.id,
            start_time=data.start_time,
            end_time=data.end_time,
            is_booked=False,
        )

        session.add(new_slot)
        session.commit()
        session.refresh(new_slot)
        return new_slot

    @staticmethod
    def get_all_slots(*, session: Session) -> list[Slot]:
        return session.exec(select(Slot)).all()

    @staticmethod
    def get_professor_slots(*, session: Session, professor: User) -> list[Slot]:
        return session.exec(select(Slot).where(Slot.professor_id == professor.id)).all()

    @staticmethod
    def delete_slot(*, session: Session, professor: User, slot_id: int) -> None:
        slot = session.get(Slot, slot_id)
        if not slot:
            raise HTTPException(status_code=404, detail="Slot not found")
        if slot.professor_id != professor.id:
            raise HTTPException(status_code=403, detail="You can only delete your own slots")

        active_booking = session.exec(
            select(Booking).where(
                Booking.slot_id == slot_id,
                Booking.status.in_([BookingStatus.booked, BookingStatus.queued]),
            )
        ).first()
        if active_booking:
            raise HTTPException(
                status_code=400, detail="Cannot delete slot with active bookings"
            )

        session.delete(slot)
        session.commit()
