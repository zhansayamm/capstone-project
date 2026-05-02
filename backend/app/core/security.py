import hashlib
import logging

import bcrypt
from jose import jwt
from passlib.context import CryptContext

from app.core.config import settings

logger = logging.getLogger(__name__)

pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
)


def normalize_password(password: str) -> str:
    # Fixed 64-char ASCII input for current bcrypt path (any user password length).
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def hash_password(password: str) -> str:
    """New hashes: bcrypt(sha256(password)) via native bcrypt (stable across bcrypt/passlib versions)."""
    digest = normalize_password(password).encode("ascii")
    logger.debug("hash_password: normalized_len=%s", len(digest))
    return bcrypt.hashpw(digest, bcrypt.gensalt(rounds=12)).decode("ascii")


def verify_password(password: str, hash: str) -> bool:  # noqa: A002
    """Try current scheme first, then legacy schemes used in earlier deployments."""
    if not hash:
        return False
    stored = hash.encode("ascii")

    # 1) Current: bcrypt(sha256(password)) — native bcrypt; compatible with passlib-produced $2b$ of same digest
    try:
        if bcrypt.checkpw(normalize_password(password).encode("ascii"), stored):
            return True
    except (ValueError, TypeError):
        pass

    # 2) Legacy: passlib bcrypt of full plaintext (old default before SHA256 pre-hash)
    for candidate in (
        password,
        password[:72],  # legacy char truncation used in some versions
        password.encode("utf-8")[:72].decode("utf-8", errors="ignore"),  # legacy UTF-8 byte truncation
    ):
        try:
            if pwd_context.verify(candidate, hash):
                return True
        except (ValueError, TypeError, Exception):
            continue

    # 3) Legacy: native bcrypt of UTF-8 password truncated to 72 bytes (no passlib)
    try:
        if bcrypt.checkpw(password.encode("utf-8")[:72], stored):
            return True
    except (ValueError, TypeError):
        pass

    return False


def create_token(data: dict):
    return jwt.encode(data, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str):
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
