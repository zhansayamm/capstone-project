import logging

from jose import jwt
from passlib.context import CryptContext

from app.core.config import settings

logger = logging.getLogger(__name__)

pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
)

# bcrypt supports max 72 bytes → truncate for compatibility


def _truncate_password_bcrypt(password: str) -> str:
    return password.encode("utf-8")[:72].decode("utf-8", errors="ignore")


def hash_password(password: str) -> str:
    password = _truncate_password_bcrypt(password)
    return pwd_context.hash(password)


def verify_password(password: str, hash: str) -> bool:  # noqa: A002
    password = _truncate_password_bcrypt(password)
    logger.debug("verify_password: password_byte_len=%s", len(password.encode("utf-8")))
    return pwd_context.verify(password, hash)


def create_token(data: dict):
    return jwt.encode(data, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str):
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
