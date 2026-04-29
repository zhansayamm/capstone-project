from jose import jwt
from passlib.context import CryptContext
from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"])

def hash_password(password: str):
    # bcrypt only uses the first 72 bytes/characters of the password.
    # Prevent backend crashes and avoid silent truncation.
    if len(password) > 72:
        raise ValueError("Password too long (max 72 characters)")
    return pwd_context.hash(password[:72])

def verify_password(password, hash):
    return pwd_context.verify(password, hash)

def create_token(data: dict):
    return jwt.encode(data, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def decode_token(token: str):
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])