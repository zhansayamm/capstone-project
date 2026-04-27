from fastapi import APIRouter, Depends
from sqlmodel import Session
from typing import List

from app.db import get_session
from app.schemas.classroom import ClassroomCreate, ClassroomRead
from app.core.deps import require_admin
from app.services.classroom_service import ClassroomService

router = APIRouter()

@router.post("/", response_model=ClassroomRead)
def create_classroom(
    data: ClassroomCreate,
    current_user = Depends(require_admin),
    session: Session = Depends(get_session)
):
    return ClassroomService.create_classroom(session=session, data=data)

@router.get("/", response_model=List[ClassroomRead])
def get_classrooms(session: Session = Depends(get_session)):
    return ClassroomService.list_classrooms(session=session)