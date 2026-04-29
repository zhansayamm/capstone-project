from pydantic import BaseModel, EmailStr, field_validator
from app.models.enums import UserRole


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    role: UserRole
    university_id: int

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters long")
        if len(v.encode("utf-8")) > 72:
            raise ValueError("Password must be at most 72 bytes")
        return v


class UserRead(BaseModel):
    id: int
    email: EmailStr
    role: UserRole
    university_id: int | None = None

    class Config:
        from_attributes = True