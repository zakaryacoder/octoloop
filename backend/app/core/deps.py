"""Dependencies: auth, RBAC (require_perm), persistent lockout, rate limiting, audit."""
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import decode_access_token
from app.core.config import settings
from app.models.user import User, Role
from app.models.audit import AuditLog

bearer_scheme = HTTPBearer(auto_error=False)

# In-memory login rate-limit: {(ip, username): deque[timestamps]} — 429 over threshold.
# Persistent lockout lives in users.failed_login_count / users.locked_until (survives restart).
_RATE_LIMIT_BUCKETS: dict = defaultdict(deque)


def _rate_limit_check(ip: str, username: str) -> Optional[str]:
    """Return error detail if rate-limited, else None. Sliding 60s window."""
    key = (ip, username)
    now = time.time()
    bucket = _RATE_LIMIT_BUCKETS[key]
    while bucket and now - bucket[0] > 60:
        bucket.popleft()
    if len(bucket) >= settings.LOGIN_RATE_LIMIT_PER_MINUTE:
        return f"Too many login attempts. Rate limit: {settings.LOGIN_RATE_LIMIT_PER_MINUTE}/min."
    bucket.append(now)
    return None


def clear_rate_limit_buckets() -> None:
    """Test hook: reset in-memory rate-limit state between tests."""
    _RATE_LIMIT_BUCKETS.clear()


def check_login_lockout(user: Optional[User]) -> Optional[str]:
    """Persistent lockout via users.locked_until. Returns error message if locked."""
    if user is None:
        return None
    now = datetime.now(timezone.utc)
    if user.locked_until is not None:
        locked_until = user.locked_until if user.locked_until.tzinfo else user.locked_until.replace(tzinfo=timezone.utc)
        if locked_until > now:
            secs = int((locked_until - now).total_seconds())
            return f"Account locked due to too many failed attempts. Try again in {secs}s."
    return None


def register_login_failure(db: Session, user: Optional[User]) -> None:
    """Increment persistent failed-login counter; lock after MAX_LOGIN_FAILS."""
    if user is None:
        return
    user.failed_login_count = (user.failed_login_count or 0) + 1
    if user.failed_login_count >= settings.MAX_LOGIN_FAILS:
        user.locked_until = datetime.now(timezone.utc) + timedelta(minutes=settings.LOCKOUT_MINUTES)
        user.failed_login_count = 0
    db.add(user)


def reset_login_failures(user: Optional[User]) -> None:
    if user is None:
        return
    user.failed_login_count = 0
    user.locked_until = None


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None or not credentials.credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    payload = decode_access_token(credentials.credentials)
    if payload is None or "sub" not in payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    user = db.query(User).filter(User.id == int(payload["sub"]), User.is_active == True).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")
    return user


def _user_permissions(db: Session, user: User) -> set:
    """Resolve permission strings for a user via their role -> Role.permissions."""
    role = db.query(Role).filter(Role.name == user.role).first()
    if not role:
        return set()
    return {p.name for p in role.permissions}


def require_perm(permission: str):
    """Dependency factory: require a specific permission string.
    Unauthenticated -> 401 (from get_current_user); authenticated but missing perm -> 403."""
    required = permission

    def _checker(
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> User:
        perms = _user_permissions(db, current_user)
        if required not in perms:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Missing required permission: {required}.",
            )
        return current_user

    return _checker


def require_roles(*roles: str):
    """Legacy role-check dependency retained for backward compatibility.
    Prefer require_perm for new endpoints."""
    allowed = set(roles)

    def _checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires one of roles: {', '.join(sorted(allowed))}",
            )
        return current_user

    return _checker


def write_audit_log(
    db: Session,
    *,
    user: Optional[User],
    action: str,
    entity_type: str = "",
    entity_id: Optional[int] = None,
    details: str = "",
    request: Optional[Request] = None,
):
    ip = ""
    if request is not None:
        ip = request.client.host if request.client else ""
    log = AuditLog(
        user_id=user.id if user else None,
        username=user.username if user else "",
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        ip_address=ip,
        details=details,
    )
    db.add(log)
