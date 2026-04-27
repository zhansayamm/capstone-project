from pydantic import BaseModel, EmailStr
from app.models.enums import UserRole


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    role: UserRole


class UserRead(BaseModel):
    id: int
    email: EmailStr
    role: UserRole

    class Config:
        from_attributes = True