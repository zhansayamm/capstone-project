from jose import jwt
import bcrypt

from app.core.config import settings

# Native bcrypt (avoid passlib + bcrypt 5.x incompatibility: missing __about__.__version__)


def hash_password(password: str) -> str:
    # bcrypt only uses the first 72 bytes/characters of the password.
    if len(password) > 72:
        raise ValueError("Password too long (max 72 characters)")
    hashed = bcrypt.hashpw(password.encode("utf-8")[:72], bcrypt.gensalt(rounds=12))
    return hashed.decode("ascii")


def verify_password(plain_password: str, password_hash: str) -> bool:
    if not plain_password or not password_hash:
        return False
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8")[:72],
            password_hash.encode("utf-8"),
        )
    except (ValueError, TypeError):
        return False


def create_token(data: dict):
    return jwt.encode(data, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str):
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
