from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.db import get_session
from app.core.deps import require_admin
from app.services.admin_service import AdminService


router = APIRouter()

@router.get("/stats")
def get_stats(
    current_user = Depends(require_admin),
    session: Session = Depends(get_session)
):
    return AdminService.get_totals(session=session)

@router.get("/bookings")
def booking_analytics(
    current_user = Depends(require_admin),
    session: Session = Depends(get_session)
):
    return AdminService.get_booking_stats(session=session)

@router.get("/top-professors")
def top_professors(
    current_user = Depends(require_admin),
    session: Session = Depends(get_session)
):
    return AdminService.get_top_professors(session=session)


@router.get("/top-classrooms")
def top_classrooms(
    current_user = Depends(require_admin),
    session: Session = Depends(get_session)
):
    return AdminService.get_top_classrooms(session=session)