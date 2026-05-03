from fastapi import APIRouter, Depends, Request
from sqlmodel import Session

from app.db import get_session
from app.schemas.user import UserCreate, UserRead
from app.schemas.auth import (
    LoginRequest,
    PasswordResetConfirmRequest,
    PasswordResetRequest,
    TokenResponse,
)
from app.core.deps import get_current_user
from app.services.auth_service import AuthService
from app.models.university import University
from app.schemas.university import UniversityRead
from app.core.limiter import limiter

router = APIRouter(redirect_slashes=False)


@router.post("/register", response_model=UserRead)
@limiter.limit("5/minute;60/hour")
def register(
    request: Request,
    data: UserCreate,
    session: Session = Depends(get_session)
):
    return AuthService.register_user(session=session, data=data)


@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute;60/hour")
def login(
    request: Request,
    data: LoginRequest,
    session: Session = Depends(get_session)
):
    return AuthService.login_user(session=session, data=data)


@router.get("/me", response_model=UserRead)
def me(current_user=Depends(get_current_user)):
    return current_user


@router.get("/university", response_model=UniversityRead)
def my_university(
    current_user=Depends(get_current_user),
    session: Session = Depends(get_session),
):
    university = session.get(University, current_user.university_id)
    return university


@router.post("/request-password-reset")
def request_password_reset(
    data: PasswordResetRequest,
    session: Session = Depends(get_session),
):
    return AuthService.request_password_reset(session=session, email=data.email)


@router.post("/reset-password")
def reset_password(
    data: PasswordResetConfirmRequest,
    session: Session = Depends(get_session),
):
    return AuthService.reset_password(
        session=session,
        token=data.token,
        new_password=data.new_password,
    )