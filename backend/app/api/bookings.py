from fastapi import APIRouter, Depends
from sqlmodel import Session
from typing import List

from app.db import get_session
from app.schemas.booking import BookingCreate, BookingRead
from app.core.deps import require_student, require_professor
from app.services.booking_service import BookingService


router = APIRouter()

@router.post("/", response_model=BookingRead)
def create_booking(
    data: BookingCreate,
    current_user = Depends(require_student),
    session: Session = Depends(get_session)
):
    return BookingService.create_booking(
        session=session, student=current_user, slot_id=data.slot_id
    )

@router.get("/me", response_model=List[BookingRead])
def get_my_bookings(
    current_user = Depends(require_student),
    session: Session = Depends(get_session)
):
    return BookingService.get_student_bookings(session=session, student=current_user)

@router.get("/professor", response_model=List[BookingRead])
def get_professor_bookings(
    current_user = Depends(require_professor),
    session: Session = Depends(get_session)
):
    return BookingService.get_professor_bookings(session=session, professor=current_user)

@router.delete("/{booking_id}")
def cancel_booking(
    booking_id: int,
    current_user = Depends(require_student),
    session: Session = Depends(get_session)
):
    BookingService.cancel_booking(session=session, student=current_user, booking_id=booking_id)
    return {"message": "Booking cancelled"}