from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.deps import get_current_user, require_perm, write_audit_log
from app.core.security import get_password_hash, validate_password_policy
from app.models.user import User, Role
from app.models.audit import AuditLog, SystemSetting
from app.models.escalation import EscalationRule
from app.schemas import (
    UserCreate, UserUpdate, UserOut, RoleOut, AuditLogOut,
    EscalationRuleCreate, EscalationRuleUpdate, EscalationRuleOut, Paginated,
)
from app.services.common import paginate

router = APIRouter(prefix="", tags=["admin"])


@router.get("/users", response_model=Paginated[UserOut])
def list_users(page: int = Query(1, ge=1), page_size: int = Query(50, ge=1, le=100),
               current_user: User = Depends(require_perm("users:manage")), db: Session = Depends(get_db)):
    q = db.query(User).order_by(User.id.asc())
    items, total, p, ps, pages = paginate(q, page, page_size)
    return Paginated[UserOut](items=items, total=total, page=p, page_size=ps, pages=pages)


@router.post("/users", response_model=UserOut, status_code=201)
def create_user(payload: UserCreate, request: Request,
                current_user: User = Depends(require_perm("users:manage")), db: Session = Depends(get_db)):
    if db.query(User).filter(User.username == payload.username).first():
        raise HTTPException(status_code=409, detail="Username already exists")
    ok, err = validate_password_policy(payload.password)
    if not ok:
        raise HTTPException(status_code=422, detail=err)
    u = User(
        username=payload.username, hashed_password=get_password_hash(payload.password),
        full_name=payload.full_name, email=payload.email, role=payload.role, is_active=True,
    )
    db.add(u)
    db.flush()
    write_audit_log(db, user=current_user, action="USER_CREATE", entity_type="user", entity_id=u.id,
                    details=f"Created user {u.username} role={u.role}", request=request)
    db.commit()
    db.refresh(u)
    return u


@router.put("/users/{user_id}", response_model=UserOut)
def update_user(user_id: int, payload: UserUpdate, request: Request,
                current_user: User = Depends(require_perm("users:manage")), db: Session = Depends(get_db)):
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    data = payload.model_dump(exclude_unset=True)
    if "password" in data and data["password"]:
        ok, err = validate_password_policy(data["password"])
        if not ok:
            raise HTTPException(status_code=422, detail=err)
        u.hashed_password = get_password_hash(data.pop("password"))
    for k, v in data.items():
        setattr(u, k, v)
    write_audit_log(db, user=current_user, action="USER_UPDATE", entity_type="user", entity_id=u.id, request=request)
    db.commit()
    db.refresh(u)
    return u


@router.get("/roles", response_model=list[RoleOut])
def list_roles(current_user: User = Depends(require_perm("roles:read")), db: Session = Depends(get_db)):
    roles = db.query(Role).order_by(Role.id.asc()).all()
    return [RoleOut(name=r.name, permissions=[p.name for p in r.permissions]) for r in roles]


@router.get("/audit-logs", response_model=Paginated[AuditLogOut])
def list_audit_logs(user_id: int = Query(None), page: int = Query(1, ge=1), page_size: int = Query(50, ge=1, le=200),
                    current_user: User = Depends(require_perm("audit:read")), db: Session = Depends(get_db)):
    q = db.query(AuditLog)
    if user_id:
        q = q.filter(AuditLog.user_id == user_id)
    q = q.order_by(AuditLog.timestamp.desc())
    items, total, p, ps, pages = paginate(q, page, page_size)
    return Paginated[AuditLogOut](items=items, total=total, page=p, page_size=ps, pages=pages)


@router.get("/escalation-rules", response_model=list[EscalationRuleOut])
def list_escalation_rules(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(EscalationRule).order_by(EscalationRule.level.asc(), EscalationRule.id.asc()).all()


@router.post("/escalation-rules", response_model=EscalationRuleOut, status_code=201)
def create_escalation_rule(payload: EscalationRuleCreate, request: Request,
                           current_user: User = Depends(require_perm("escalation_rules:manage")), db: Session = Depends(get_db)):
    rule = EscalationRule(**payload.model_dump())
    db.add(rule)
    db.flush()
    write_audit_log(db, user=current_user, action="ESCALATION_RULE_CREATE", entity_type="escalation_rule",
                    entity_id=rule.id, request=request)
    db.commit()
    db.refresh(rule)
    return rule


@router.put("/escalation-rules/{rule_id}", response_model=EscalationRuleOut)
def update_escalation_rule(rule_id: int, payload: EscalationRuleUpdate, request: Request,
                           current_user: User = Depends(require_perm("escalation_rules:manage")), db: Session = Depends(get_db)):
    rule = db.query(EscalationRule).filter(EscalationRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(rule, k, v)
    write_audit_log(db, user=current_user, action="ESCALATION_RULE_UPDATE", entity_type="escalation_rule",
                    entity_id=rule.id, request=request)
    db.commit()
    db.refresh(rule)
    return rule


@router.get("/settings")
def get_settings(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.query(SystemSetting).all()
    return {r.key: r.value for r in rows}


@router.put("/settings")
def put_settings(payload: dict, request: Request,
                 current_user: User = Depends(require_perm("settings:manage")), db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    for k, v in payload.items():
        row = db.query(SystemSetting).filter(SystemSetting.key == k).first()
        if row:
            row.value = str(v)
            row.updated_at = now
        else:
            db.add(SystemSetting(key=k, value=str(v), updated_at=now))
    write_audit_log(db, user=current_user, action="SETTINGS_UPDATE", entity_type="settings",
                    details=f"Updated {len(payload)} key(s)", request=request)
    db.commit()
    rows = db.query(SystemSetting).all()
    return {r.key: r.value for r in rows}
