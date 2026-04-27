from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.db import get_session
from app.schemas.slot import SlotCreate, SlotRead
from app.core.deps import require_professor
from app.services.slot_service import SlotService


router = APIRouter()

@router.post("/", response_model=SlotRead)
def create_slot(
    data: SlotCreate,
    current_user = Depends(require_professor),
    session: Session = Depends(get_session)
):
    return SlotService.create_slot(session=session, professor=current_user, data=data)



@router.get("/", response_model=list[SlotRead])
def get_all_slots(session: Session = Depends(get_session)):
    return SlotService.get_all_slots(session=session)



@router.get("/me", response_model=list[SlotRead])
def get_my_slots(
    current_user = Depends(require_professor),
    session: Session = Depends(get_session)
):
    return SlotService.get_professor_slots(session=session, professor=current_user)


@router.delete("/{slot_id}")
def delete_slot(
    slot_id: int,
    current_user = Depends(require_professor),
    session: Session = Depends(get_session)
):
    SlotService.delete_slot(session=session, professor=current_user, slot_id=slot_id)
    return {"message": "Slot deleted"}