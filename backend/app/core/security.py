import hashlib
import logging

from jose import jwt
from passlib.context import CryptContext

from app.core.config import settings

logger = logging.getLogger(__name__)

pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
)


def normalize_password(password: str) -> str:
    # Convert ANY password into fixed-length string (64 chars) before bcrypt (72-byte limit).
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def hash_password(password: str) -> str:
    normalized = normalize_password(password)
    logger.debug("Normalized password length: %s", len(normalized))
    return pwd_context.hash(normalized)


def verify_password(password: str, hash: str) -> bool:  # noqa: A002
    normalized = normalize_password(password)
    logger.debug("Normalized password length: %s", len(normalized))
    return pwd_context.verify(normalized, hash)


def create_token(data: dict):
    return jwt.encode(data, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str):
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
