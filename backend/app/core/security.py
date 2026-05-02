import logging

from jose import jwt
from passlib.context import CryptContext

from app.core.config import settings

logger = logging.getLogger(__name__)

pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
)


def hash_password(password: str) -> str:
    # bcrypt only uses the first 72 bytes/characters of the password.
    if len(password) > 72:
        raise ValueError("Password too long (max 72 characters)")
    return pwd_context.hash(password[:72])


def verify_password(password: str, password_hash: str) -> bool:
    password = password[:72]
    logger.debug("verify_password: password_len=%s", len(password))
    return pwd_context.verify(password, password_hash)


def create_token(data: dict):
    return jwt.encode(data, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str):
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
