from fastapi import HTTPException, status
from sqlmodel import Session, select

from app.core.security import create_token, hash_password, verify_password
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.auth import LoginRequest
from app.schemas.user import UserCreate


class AuthService:
    @staticmethod
    def register_user(*, session: Session, data: UserCreate) -> User:
        if data.role not in (UserRole.student, UserRole.professor, UserRole.admin):
            raise HTTPException(status_code=400, detail="Invalid user role")

        existing_user = session.exec(select(User).where(User.email == data.email)).first()
        if existing_user:
            raise HTTPException(status_code=400, detail="Email already registered")

        user = User(
            email=data.email,
            password_hash=hash_password(data.password),
            role=data.role,
        )

        session.add(user)
        session.commit()
        session.refresh(user)
        return user

    @staticmethod
    def login_user(*, session: Session, data: LoginRequest) -> dict:
        user = session.exec(select(User).where(User.email == data.email)).first()
        if not user or not verify_password(data.password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials"
            )

        token = create_token({"user_id": user.id, "role": user.role.value})
        return {"access_token": token, "token_type": "bearer"}
