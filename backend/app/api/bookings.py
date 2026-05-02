from fastapi import APIRouter, Depends, Query, Request
from sqlmodel import Session
from typing import List

from app.db import get_session
from app.schemas.booking import BookingCreate, BookingRead
from app.core.deps import require_admin, require_student, require_professor
from app.services.booking_service import BookingService
from app.core.limiter import limiter


router = APIRouter()

@router.get("/", response_model=List[BookingRead])
def list_bookings(
    current_user=Depends(require_admin),
    session: Session = Depends(get_session),
    limit: int = Query(10, ge=1, le=100),
    offset: int = Query(0, ge=0),
    upcoming: bool = False,
):
    return BookingService.get_all_bookings(
        session=session,
        university_id=current_user.university_id,
        limit=limit,
        offset=offset,
        upcoming=upcoming,
    )

@router.post("/", response_model=BookingRead)
@limiter.limit("10/minute;120/hour")
def create_booking(
    request: Request,
    data: BookingCreate,
    current_user = Depends(require_student),
    session: Session = Depends(get_session)
):
    return BookingService.create_booking(
        session=session, student=current_user, slot_id=data.slot_id, description=data.description
    )

@router.get("/me", response_model=List[BookingRead])
def get_my_bookings(
    current_user = Depends(require_student),
    session: Session = Depends(get_session),
    limit: int = Query(10, ge=1, le=100),
    offset: int = Query(0, ge=0),
    upcoming: bool = False,
):
    return BookingService.get_student_bookings(
        session=session,
        student=current_user,
        limit=limit,
        offset=offset,
        upcoming=upcoming,
    )

@router.get("/professor", response_model=List[BookingRead])
def get_professor_bookings(
    current_user = Depends(require_professor),
    session: Session = Depends(get_session),
    limit: int = Query(10, ge=1, le=100),
    offset: int = Query(0, ge=0),
    upcoming: bool = False,
):
    return BookingService.get_professor_bookings(
        session=session,
        professor=current_user,
        limit=limit,
        offset=offset,
        upcoming=upcoming,
    )

@router.delete("/{booking_id}")
@limiter.limit("2/minute;20/hour")
def cancel_booking(
    request: Request,
    booking_id: int,
    current_user = Depends(require_student),
    session: Session = Depends(get_session)
):
    BookingService.cancel_booking(session=session, student=current_user, booking_id=booking_id)
    return {"message": "Booking cancelled"}