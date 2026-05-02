from fastapi import APIRouter, Depends, Query, Request
from sqlmodel import Session
from datetime import datetime

from app.db import get_session
from app.schemas.slot import SlotCreate, SlotRead
from app.core.deps import get_optional_user, require_professor
from app.services.slot_service import SlotService
from app.core.limiter import limiter


router = APIRouter()

@router.post("/", response_model=list[SlotRead])
@limiter.limit("10/minute;120/hour")
def create_slot(
    request: Request,
    data: SlotCreate,
    current_user = Depends(require_professor),
    session: Session = Depends(get_session)
):
    return SlotService.create_slot(session=session, professor=current_user, data=data)



@router.get("/", response_model=list[SlotRead])
def get_all_slots(
    session: Session = Depends(get_session),
    current_user=Depends(get_optional_user),
    limit: int = Query(10, ge=1, le=100),
    offset: int = Query(0, ge=0),
    professor_id: int | None = None,
    available: bool | None = None,
    start_time_gte: datetime | None = None,
    end_time_lte: datetime | None = None,
):
    if current_user is None:
        return []
    return SlotService.list_slots(
        session=session,
        university_id=current_user.university_id,
        limit=limit,
        offset=offset,
        professor_id=professor_id,
        available=available,
        start_time_gte=start_time_gte,
        end_time_lte=end_time_lte,
    )



@router.get("/me", response_model=list[SlotRead])
def get_my_slots(
    current_user = Depends(require_professor),
    session: Session = Depends(get_session)
):
    return SlotService.get_professor_slots(session=session, professor=current_user)


@router.delete("/{slot_id}")
@limiter.limit("2/minute;20/hour")
def delete_slot(
    request: Request,
    slot_id: int,
    current_user = Depends(require_professor),
    session: Session = Depends(get_session)
):
    SlotService.delete_slot(session=session, professor=current_user, slot_id=slot_id)
    return {"message": "Slot deleted"}