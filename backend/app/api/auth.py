from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.db import get_session
from app.schemas.user import UserCreate, UserRead
from app.schemas.auth import LoginRequest, TokenResponse
from app.services.auth_service import AuthService

router = APIRouter()


@router.post("/register", response_model=UserRead)
def register(
    data: UserCreate,
    session: Session = Depends(get_session)
):
    return AuthService.register_user(session=session, data=data)


@router.post("/login", response_model=TokenResponse)
def login(
    data: LoginRequest,
    session: Session = Depends(get_session)
):
    return AuthService.login_user(session=session, data=data)