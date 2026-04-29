from fastapi import APIRouter, Depends
from sqlmodel import Session
from typing import List

from app.db import get_session
from app.schemas.classroom import ClassroomCreate, ClassroomRead
from app.core.deps import get_optional_user, require_admin
from app.services.classroom_service import ClassroomService

router = APIRouter()

@router.post("/", response_model=ClassroomRead)
def create_classroom(
    data: ClassroomCreate,
    current_user = Depends(require_admin),
    session: Session = Depends(get_session)
):
    return ClassroomService.create_classroom(session=session, admin=current_user, data=data)

@router.get("/", response_model=List[ClassroomRead])
def get_classrooms(
    session: Session = Depends(get_session),
    current_user=Depends(get_optional_user),
):
    if current_user is None:
        return []
    return ClassroomService.list_classrooms(session=session, university_id=current_user.university_id)


@router.delete("/{classroom_id}")
def delete_classroom(
    classroom_id: int,
    current_user=Depends(require_admin),
    session: Session = Depends(get_session),
):
    ClassroomService.delete_classroom(session=session, admin=current_user, classroom_id=classroom_id)
    return {"message": "Classroom deleted"}