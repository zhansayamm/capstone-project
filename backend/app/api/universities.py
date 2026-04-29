from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.core.deps import require_admin
from app.db import get_session
from app.schemas.university import UniversityCreate, UniversityRead
from app.services.university_service import UniversityService


router = APIRouter()


@router.get("/", response_model=list[UniversityRead])
def list_universities(session: Session = Depends(get_session)):
    return UniversityService.list_universities(session=session)


@router.post("/", response_model=UniversityRead)
def create_university(
    data: UniversityCreate,
    current_user=Depends(require_admin),
    session: Session = Depends(get_session),
):
    return UniversityService.create_university(session=session, name=data.name)
