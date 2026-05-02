import hashlib
import logging

import bcrypt
from jose import jwt

from app.core.config import settings

logger = logging.getLogger(__name__)

# SHA256 hex (64 ASCII chars) → bcrypt input always < 72 bytes; no passlib bcrypt backend (avoids init bugs).


def normalize_password(password: str) -> str:
    # Convert ANY password into fixed-length string (64 chars) before bcrypt (72-byte limit).
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def hash_password(password: str) -> str:
    normalized = normalize_password(password)
    logger.debug("Normalized password length: %s", len(normalized))
    digest = normalized.encode("ascii")
    hashed = bcrypt.hashpw(digest, bcrypt.gensalt(rounds=12))
    return hashed.decode("ascii")


def verify_password(password: str, hash: str) -> bool:  # noqa: A002
    if not hash:
        return False
    normalized = normalize_password(password)
    logger.debug("Normalized password length: %s", len(normalized))
    digest = normalized.encode("ascii")
    try:
        return bcrypt.checkpw(digest, hash.encode("ascii"))
    except (ValueError, TypeError):
        return False


def create_token(data: dict):
    return jwt.encode(data, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str):
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
