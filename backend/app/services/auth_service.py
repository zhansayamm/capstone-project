from app.core.exceptions import ConflictException, NotFoundException, UnauthorizedException
from sqlmodel import Session, select
import logging

from app.core.security import create_token, decode_token, hash_password, verify_password
from app.models.enums import UserRole
from app.models.university import University
from app.models.user import User
from app.schemas.auth import LoginRequest
from app.schemas.user import UserCreate
from app.tasks.email_tasks import send_email_task

from datetime import datetime, timedelta, timezone


logger = logging.getLogger(__name__)


class AuthService:
    @staticmethod
    def request_password_reset(*, session: Session, email: str) -> dict:
        user = session.exec(select(User).where(User.email == email)).first()

        # Security: do not reveal whether the email exists.
        if user:
            now = datetime.now(timezone.utc)
            exp = int((now + timedelta(minutes=15)).timestamp())
            token = create_token(
                {"user_id": user.id, "type": "password_reset", "exp": exp}
            )

            link = f"http://localhost:8000/auth/reset-password?token={token}"
            send_email_task.delay(
                user.email,
                "Password Reset",
                f"Click here to reset your password: {link}",
            )

        return {
            "message": "If this email exists, a reset link was sent"
        }

    @staticmethod
    def reset_password(
        *,
        session: Session,
        token: str,
        new_password: str,
    ) -> dict:
        try:
            payload = decode_token(token)
        except Exception:
            raise UnauthorizedException("Invalid or expired token")

        if payload.get("type") != "password_reset":
            raise UnauthorizedException("Invalid or expired token")

        raw_user_id = payload.get("user_id")
        if raw_user_id is None:
            raise UnauthorizedException("Invalid or expired token")

        user_id = int(raw_user_id)
        user = session.get(User, user_id)
        if not user:
            raise UnauthorizedException("Invalid or expired token")

        try:
            user.password_hash = hash_password(new_password)
        except Exception:
            # Keeps the error consistent with the existing exception handler behavior.
            raise UnauthorizedException("Invalid password")

        session.add(user)
        session.commit()
        session.refresh(user)
        return {"message": "Password successfully reset"}

    @staticmethod
    def register_user(*, session: Session, data: UserCreate) -> User:
        if data.role not in (UserRole.student, UserRole.professor, UserRole.admin):
            raise ConflictException("Invalid user role")

        if len(data.password.encode("utf-8")) > 72:
            raise ConflictException("Password must be at most 72 bytes")

        university = session.get(University, data.university_id)
        if not university:
            raise NotFoundException("University not found")

        existing_user = session.exec(select(User).where(User.email == data.email)).first()
        if existing_user:
            raise ConflictException("Email already registered")

        user = User(
            email=data.email,
            password_hash=hash_password(data.password),
            role=data.role,
            university_id=data.university_id,
        )

        session.add(user)
        session.commit()
        session.refresh(user)
        return user

    @staticmethod
    def login_user(*, session: Session, data: LoginRequest) -> dict:
        logger.info("Login attempt: %s", data.email)
        user = session.exec(select(User).where(User.email == data.email)).first()
        if not user or not verify_password(data.password, user.password_hash):
            logger.warning("Login failed: %s", data.email)
            raise UnauthorizedException("Invalid credentials")

        logger.info("Login success: %s", data.email)
        token = create_token({"user_id": user.id, "role": user.role.value})
        return {"access_token": token, "token_type": "bearer"}
