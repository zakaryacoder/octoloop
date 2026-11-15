from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.deps import get_current_user, require_perm, write_audit_log
from app.models.user import User, DeliveryLog
from app.models.notification import Notification
from app.models.case import FollowUpCase
from app.schemas import (
    NotificationSend, NotificationOut, Paginated, NotificationPreferences, DeliveryLogOut,
)
from app.services.common import paginate, add_case_event
from app.services.notifications import dispatch_notification, get_or_create_preferences, parse_preferences

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=Paginated[NotificationOut])
def list_notifications(audience: str = Query(None), status: str = Query(None), case_id: int = Query(None),
                       page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
                       current_user: User = Depends(require_perm("notifications:read")), db: Session = Depends(get_db)):
    q = db.query(Notification)
    if audience:
        q = q.filter(Notification.audience == audience)
    if status:
        q = q.filter(Notification.status == status)
    if case_id:
        q = q.filter(Notification.case_id == case_id)
    q = q.order_by(Notification.created_at.desc())
    items, total, p, ps, pages = paginate(q, page, page_size)
    return Paginated[NotificationOut](items=items, total=total, page=p, page_size=ps, pages=pages)


@router.post("/send", response_model=NotificationOut, status_code=201)
def send_notification(payload: NotificationSend, request: Request,
                      current_user: User = Depends(require_perm("notifications:send")), db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    n = Notification(
        audience=payload.audience, patient_id=payload.patient_id, staff_user_id=payload.staff_user_id,
        case_id=payload.case_id, channel=payload.channel, status="PENDING",
        subject=payload.subject, message=payload.message, sent_at=None,
    )
    db.add(n)
    db.flush()
    # V2: dispatch through provider architecture. Sets SENT only if a real provider accepted;
    # QUEUED if no provider configured; FAILED if provider errored. Never fakes SENT.
    dispatch_notification(db, n)
    if payload.case_id:
        case = db.query(FollowUpCase).filter(FollowUpCase.id == payload.case_id).first()
        if case:
            add_case_event(db, case, event_type="NOTIFICATION_SENT",
                           note=f"Notification via {payload.channel}: {payload.subject} (status={n.status})",
                           actor_id=current_user.id)
            case.last_contact_at = now
    write_audit_log(db, user=current_user, action="NOTIFICATION_SEND", entity_type="notification", entity_id=n.id,
                    details=f"audience={payload.audience} channel={payload.channel} status={n.status}", request=request)
    db.commit()
    db.refresh(n)
    return n


@router.get("/staff/unread", response_model=list[NotificationOut])
def staff_unread(current_user: User = Depends(require_perm("notifications:read")), db: Session = Depends(get_db)):
    items = (
        db.query(Notification)
        .filter(Notification.audience == "STAFF", Notification.staff_user_id == current_user.id,
                Notification.status != "ACKNOWLEDGED")
        .order_by(Notification.created_at.desc())
        .all()
    )
    return items


@router.post("/{notification_id}/acknowledge", response_model=NotificationOut)
def acknowledge(notification_id: int, request: Request,
                current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    n = db.query(Notification).filter(Notification.id == notification_id).first()
    if not n:
        raise HTTPException(status_code=404, detail="Notification not found")
    n.status = "ACKNOWLEDGED"
    n.acknowledged_at = datetime.now(timezone.utc)
    write_audit_log(db, user=current_user, action="NOTIFICATION_ACK", entity_type="notification", entity_id=n.id,
                    request=request)
    db.commit()
    db.refresh(n)
    return n


@router.get("/preferences", response_model=NotificationPreferences)
def get_preferences(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    pref = get_or_create_preferences(db, current_user.id)
    db.commit()
    return NotificationPreferences(channel_enabled=parse_preferences(pref))


@router.put("/preferences", response_model=NotificationPreferences)
def put_preferences(payload: NotificationPreferences, request: Request,
                    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    import json
    pref = get_or_create_preferences(db, current_user.id)
    pref.channel_enabled = json.dumps(payload.channel_enabled)
    write_audit_log(db, user=current_user, action="NOTIFICATION_PREFS_UPDATE", entity_type="notification",
                    details="Updated notification channel preferences", request=request)
    db.commit()
    return NotificationPreferences(channel_enabled=parse_preferences(pref))


@router.get("/{notification_id}/delivery-logs", response_model=list[DeliveryLogOut])
def delivery_logs(notification_id: int,
                  current_user: User = Depends(require_perm("notifications:read")), db: Session = Depends(get_db)):
    n = db.query(Notification).filter(Notification.id == notification_id).first()
    if not n:
        raise HTTPException(status_code=404, detail="Notification not found")
    return db.query(DeliveryLog).filter(DeliveryLog.notification_id == notification_id).order_by(DeliveryLog.created_at.desc()).all()
