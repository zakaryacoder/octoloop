import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import (
    verify_password, create_access_token,
    generate_refresh_token, hash_refresh_token, refresh_token_expiry,
)
from app.core.config import settings
from app.core.deps import (
    get_current_user, check_login_lockout, register_login_failure, reset_login_failures,
    write_audit_log, _rate_limit_check,
)
from app.models.user import User, RefreshToken
from app.schemas import (
    LoginRequest, TokenResponse, UserOut, RefreshRequest, RefreshResponse, LogoutRequest,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _issue_refresh_token(db: Session, user: User, family_id: str | None = None) -> str:
    """Create a new refresh token row (hashed). Returns the plain opaque token to the caller."""
    plain = generate_refresh_token()
    rt = RefreshToken(
        user_id=user.id,
        token_hash=hash_refresh_token(plain),
        family_id=family_id or uuid.uuid4().hex,
        expires_at=refresh_token_expiry(),
    )
    db.add(rt)
    db.flush()
    return plain


def _revoke_family(db: Session, family_id: str) -> None:
    """Revoke every token in a refresh family (reuse detection response)."""
    now = datetime.now(timezone.utc)
    tokens = db.query(RefreshToken).filter(RefreshToken.family_id == family_id).all()
    for t in tokens:
        if t.revoked_at is None:
            t.revoked_at = now


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    ip = request.client.host if request.client else "unknown"
    rate_msg = _rate_limit_check(ip, payload.username)
    if rate_msg:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=rate_msg)

    user = db.query(User).filter(User.username == payload.username, User.is_active == True).first()

    lock_msg = check_login_lockout(user)
    if lock_msg:
        write_audit_log(db, user=user, action="LOGIN_LOCKED", entity_type="auth",
                        details=f"Login while locked for username={payload.username}", request=request)
        db.commit()
        raise HTTPException(status_code=status.HTTP_423_LOCKED, detail=lock_msg)

    if user is None or not verify_password(payload.password, user.hashed_password):
        register_login_failure(db, user)
        write_audit_log(db, user=user, action="LOGIN_FAILED", entity_type="auth",
                        details=f"Failed login for username={payload.username}", request=request)
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password")

    reset_login_failures(user)
    user.last_login_at = datetime.now(timezone.utc)
    write_audit_log(db, user=user, action="LOGIN", entity_type="auth", details="User logged in", request=request)

    refresh_plain = _issue_refresh_token(db, user)  # new family
    db.commit()

    access_token = create_access_token(subject=user.id, role=user.role, username=user.username)
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user={"id": user.id, "username": user.username, "full_name": user.full_name, "role": user.role},
        refresh_token=refresh_plain,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post("/refresh", response_model=RefreshResponse)
def refresh(payload: RefreshRequest, request: Request, db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    token_hash = hash_refresh_token(payload.refresh_token)
    rt = db.query(RefreshToken).filter(RefreshToken.token_hash == token_hash).first()
    if rt is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    expires_at = rt.expires_at if rt.expires_at.tzinfo else rt.expires_at.replace(tzinfo=timezone.utc)
    if expires_at < now:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token expired")

    if rt.revoked_at is not None:
        # Reuse of a revoked (already rotated) token -> revoke entire family.
        _revoke_family(db, rt.family_id)
        write_audit_log(db, user=None, action="REFRESH_FAMILY_REVOKED", entity_type="auth",
                        details=f"Reuse of revoked refresh token; family={rt.family_id[:8]}... revoked", request=request)
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Refresh token reuse detected; entire session family revoked")

    user = db.query(User).filter(User.id == rt.user_id, User.is_active == True).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")

    # Rotate: issue new token in same family; mark old revoked with replaced_by.
    new_plain = _issue_refresh_token(db, user, family_id=rt.family_id)
    new_rt = db.query(RefreshToken).filter(RefreshToken.token_hash == hash_refresh_token(new_plain)).first()
    rt.revoked_at = now
    rt.replaced_by = new_rt.id if new_rt else None
    write_audit_log(db, user=user, action="REFRESH_ROTATED", entity_type="auth",
                    details=f"Refresh token rotated for user {user.username}", request=request)
    db.commit()

    access_token = create_access_token(subject=user.id, role=user.role, username=user.username)
    return RefreshResponse(
        access_token=access_token,
        refresh_token=new_plain,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post("/logout")
def logout(payload: LogoutRequest = LogoutRequest(), request: Request = None,
           current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    if payload.refresh_token:
        token_hash = hash_refresh_token(payload.refresh_token)
        rt = db.query(RefreshToken).filter(
            RefreshToken.token_hash == token_hash, RefreshToken.user_id == current_user.id
        ).first()
        if rt and rt.revoked_at is None:
            rt.revoked_at = now
    write_audit_log(db, user=current_user, action="LOGOUT", entity_type="auth",
                    details="User logged out (refresh token revoked if provided)", request=request)
    db.commit()
    return {"ok": True}


@router.post("/logout-all")
def logout_all(request: Request, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    tokens = db.query(RefreshToken).filter(
        RefreshToken.user_id == current_user.id, RefreshToken.revoked_at.is_(None)
    ).all()
    for t in tokens:
        t.revoked_at = now
    write_audit_log(db, user=current_user, action="LOGOUT_ALL", entity_type="auth",
                    details=f"Revoked {len(tokens)} active refresh token(s)", request=request)
    db.commit()
    return {"ok": True, "revoked": len(tokens)}


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return current_user
