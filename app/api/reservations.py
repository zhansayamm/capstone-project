from fastapi import APIRouter, Depends
from sqlmodel import Session
from typing import List

from app.db import get_session
from app.schemas.reservation import ReservationCreate, ReservationRead
from app.core.deps import get_current_user
from app.services.reservation_service import ReservationService


router = APIRouter()

@router.post("/", response_model=ReservationRead)
def create_reservation(
    data: ReservationCreate,
    current_user = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    return ReservationService.create_reservation(session=session, user=current_user, data=data)

@router.get("/me", response_model=List[ReservationRead])
def get_my_reservations(
    current_user = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    return ReservationService.get_user_reservations(session=session, user=current_user)

@router.get("/", response_model=List[ReservationRead])
def get_all_reservations(session: Session = Depends(get_session)):
    return ReservationService.get_all_reservations(session=session)