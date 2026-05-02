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
    # bcrypt supports max 72 bytes
    return password.encode("utf-8")[:72].decode("utf-8", errors="ignore")


def hash_password(password: str) -> str:
    password = normalize_password(password)
    logger.debug("Normalized password length: %s", len(password))
    return pwd_context.hash(password)


def verify_password(password: str, hash: str) -> bool:  # noqa: A002
    password = normalize_password(password)
    logger.debug("Normalized password length: %s", len(password))
    return pwd_context.verify(password, hash)


def create_token(data: dict):
    return jwt.encode(data, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str):
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
