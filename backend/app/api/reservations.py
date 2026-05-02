from fastapi import APIRouter, Depends, Query, Request
from sqlmodel import Session
from typing import List

from app.db import get_session
from app.schemas.reservation import ReservationCreate, ReservationRead
from app.core.deps import get_current_user, require_admin
from app.services.reservation_service import ReservationService
from app.core.limiter import limiter


router = APIRouter()

@router.post("/", response_model=ReservationRead)
@limiter.limit("10/minute;120/hour")
def create_reservation(
    request: Request,
    data: ReservationCreate,
    current_user = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    return ReservationService.create_reservation(session=session, user=current_user, data=data)

@router.get("/me", response_model=List[ReservationRead])
def get_my_reservations(
    current_user = Depends(get_current_user),
    session: Session = Depends(get_session),
    limit: int = Query(10, ge=1, le=100),
    offset: int = Query(0, ge=0),
    upcoming: bool = False,
):
    return ReservationService.get_user_reservations(
        session=session, user=current_user, limit=limit, offset=offset, upcoming=upcoming
    )

@router.get("/", response_model=List[ReservationRead])
def get_all_reservations(
    current_user=Depends(require_admin),
    session: Session = Depends(get_session),
    limit: int = Query(10, ge=1, le=100),
    offset: int = Query(0, ge=0),
    classroom_id: int | None = None,
    user_id: int | None = None,
    upcoming: bool = False,
):
    return ReservationService.get_all_reservations(
        session=session,
        university_id=current_user.university_id,
        limit=limit,
        offset=offset,
        classroom_id=classroom_id,
        user_id=user_id,
        upcoming=upcoming,
    )


@router.delete("/{reservation_id}")
@limiter.limit("10/minute;60/hour")
def cancel_reservation(
    request: Request,
    reservation_id: int,
    current_user=Depends(get_current_user),
    session: Session = Depends(get_session),
):
    return ReservationService.cancel_reservation(session=session, reservation_id=reservation_id, user=current_user)