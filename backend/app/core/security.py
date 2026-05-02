import hashlib
import logging

import bcrypt
from jose import jwt

from app.core.config import settings

logger = logging.getLogger(__name__)

# Native bcrypt only — passlib is removed to avoid bcrypt backend init (detect_wrap_bug) and 72-byte crashes.


def normalize_password(password: str) -> str:
    # Fixed 64-char ASCII input for current bcrypt path (any user password length).
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def _bcrypt_secret_candidates(password: str) -> list[bytes]:
    """Byte preimages to try against stored bcrypt hashes (current + legacy deployments)."""
    seen: set[bytes] = set()
    out: list[bytes] = []

    def add(b: bytes) -> None:
        if b not in seen:
            seen.add(b)
            out.append(b)

    # Current: sha256(password) as 64 ASCII bytes
    add(normalize_password(password).encode("ascii"))
    # Legacy: UTF-8 password truncated to 72 bytes (bcrypt / passlib default behavior)
    add(password.encode("utf-8")[:72])
    # Legacy: first 72 Unicode chars, then UTF-8 truncated to 72 bytes
    add(password[:72].encode("utf-8")[:72])
    # Legacy: UTF-8 truncate → decode → re-encode (older app helper)
    truncated = password.encode("utf-8")[:72].decode("utf-8", errors="ignore")
    add(truncated.encode("utf-8")[:72])
    return out


def hash_password(password: str) -> str:
    digest = normalize_password(password).encode("ascii")
    logger.debug("hash_password: digest_byte_len=%s", len(digest))
    return bcrypt.hashpw(digest, bcrypt.gensalt(rounds=12)).decode("ascii")


def verify_password(password: str, hash: str) -> bool:  # noqa: A002
    if not hash:
        return False
    stored = hash.encode("ascii")
    for secret in _bcrypt_secret_candidates(password):
        try:
            if bcrypt.checkpw(secret, stored):
                return True
        except ValueError:
            # Wrong hash format or bcrypt internal rejection — try next candidate
            continue
    return False


def create_token(data: dict):
    return jwt.encode(data, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str):
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
