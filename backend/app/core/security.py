import hashlib
import re
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple
from jose import JWTError, jwt
from passlib.context import CryptContext
from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# V2: password policy — min 8 chars, upper+lower+digit+symbol.
_RE_UPPER = re.compile(r"[A-Z]")
_RE_LOWER = re.compile(r"[a-z]")
_RE_DIGIT = re.compile(r"[0-9]")
_RE_SYMBOL = re.compile(r"[^A-Za-z0-9]")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def validate_password_policy(password: str) -> Tuple[bool, str]:
    """Return (ok, error_message). Enforced on user create/update + patient self-service."""
    if not password or len(password) < 8:
        return False, "Password must be at least 8 characters long."
    if not _RE_UPPER.search(password):
        return False, "Password must contain at least one uppercase letter."
    if not _RE_LOWER.search(password):
        return False, "Password must contain at least one lowercase letter."
    if not _RE_DIGIT.search(password):
        return False, "Password must contain at least one digit."
    if not _RE_SYMBOL.search(password):
        return False, "Password must contain at least one symbol (non-alphanumeric character)."
    return True, ""


def create_access_token(subject: str, role: str, username: str, expires_minutes: Optional[int] = None) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=expires_minutes or settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    to_encode = {"sub": str(subject), "role": role, "username": username, "exp": expire}
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_access_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        return None


# ---------------- Refresh tokens (opaque, stored hashed) ----------------

def generate_refresh_token() -> str:
    """Opaque random refresh token (returned to client once, never stored plain)."""
    return secrets.token_urlsafe(48)


def hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def refresh_token_expiry() -> datetime:
    return datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
