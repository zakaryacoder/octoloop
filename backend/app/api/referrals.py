from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_perm, write_audit_log
from app.models.user import User
from app.models.patient import Patient
from app.models.referral import Referral
from app.models.case import FollowUpCase
from app.schemas import (
    ReferralCreate, ReferralAccept, ReferralReject, ReferralComplete, ReferralOut, Paginated,
)
from app.services.common import paginate, add_case_event
from app.services.serializers import serialize_referral

router = APIRouter(prefix="/referrals", tags=["referrals"])


@router.get("", response_model=Paginated[ReferralOut])
def list_referrals(status: str = Query(None), page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
                   current_user: User = Depends(require_perm("referrals:read")), db: Session = Depends(get_db)):
    q = db.query(Referral)
    if status:
        q = q.filter(Referral.status == status)
    q = q.order_by(Referral.created_at.desc())
    items, total, p, ps, pages = paginate(q, page, page_size)
    return Paginated[ReferralOut](items=[serialize_referral(db, r) for r in items], total=total, page=p, page_size=ps, pages=pages)


@router.post("", response_model=ReferralOut, status_code=201)
def create_referral(payload: ReferralCreate, request: Request, current_user: User = Depends(require_perm("referrals:create")), db: Session = Depends(get_db)):
    if not db.query(Patient).filter(Patient.id == payload.patient_id).first():
        raise HTTPException(status_code=404, detail="Patient not found")
    case = None
    if payload.case_id:
        case = db.query(FollowUpCase).filter(FollowUpCase.id == payload.case_id).first()
        if not case:
            raise HTTPException(status_code=404, detail="Case not found")
    r = Referral(
        patient_id=payload.patient_id, case_id=payload.case_id,
        from_department="Primary Care", to_department=payload.to_department,
        reason=payload.reason, status="DRAFT", notes=payload.notes or "",
    )
    db.add(r)
    db.flush()
    if case:
        add_case_event(db, case, event_type="REFERRAL_CREATED", note=f"Referral to {r.to_department} (DRAFT).", actor_id=current_user.id)
    write_audit_log(db, user=current_user, action="REFERRAL_CREATE", entity_type="referral", entity_id=r.id,
                    details=f"Referral to {r.to_department}", request=request)
    db.commit()
    db.refresh(r)
    return serialize_referral(db, r)


@router.post("/{referral_id}/send", response_model=ReferralOut)
def send_referral(referral_id: int, request: Request, current_user: User = Depends(require_perm("referrals:manage")), db: Session = Depends(get_db)):
    r = db.query(Referral).filter(Referral.id == referral_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Referral not found")
    if r.status not in ("DRAFT",):
        raise HTTPException(status_code=400, detail=f"Cannot send referral in status {r.status}")
    r.status = "SENT"
    r.sent_at = datetime.now(timezone.utc)
    if r.case_id:
        case = db.query(FollowUpCase).filter(FollowUpCase.id == r.case_id).first()
        if case and case.status in ("AWAITING_CONFIRMATION", "PATIENT_NOTIFIED", "REFERRAL_PENDING"):
            case.status = "REFERRAL_PENDING"
            add_case_event(db, case, event_type="STATUS_CHANGE", note="Referral sent; status -> REFERRAL_PENDING.", actor_id=current_user.id)
    write_audit_log(db, user=current_user, action="REFERRAL_SEND", entity_type="referral", entity_id=r.id, request=request)
    db.commit()
    db.refresh(r)
    return serialize_referral(db, r)


@router.post("/{referral_id}/accept", response_model=ReferralOut)
def accept_referral(referral_id: int, payload: ReferralAccept, request: Request,
                    current_user: User = Depends(require_perm("referrals:manage")), db: Session = Depends(get_db)):
    r = db.query(Referral).filter(Referral.id == referral_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Referral not found")
    if r.status != "SENT":
        raise HTTPException(status_code=400, detail=f"Cannot accept referral in status {r.status}")
    r.status = "ACCEPTED"
    r.responded_at = datetime.now(timezone.utc)
    if payload.notes:
        r.notes = (r.notes + " | " if r.notes else "") + f"Accept note: {payload.notes}"
    if r.case_id:
        case = db.query(FollowUpCase).filter(FollowUpCase.id == r.case_id).first()
        if case and case.status != "CLOSED":
            case.status = "APPOINTMENT_PENDING"
            add_case_event(db, case, event_type="STATUS_CHANGE", note="Referral accepted; status -> APPOINTMENT_PENDING.", actor_id=current_user.id)
        elif case:
            add_case_event(db, case, event_type="NOTE", note=f"Referral to {r.to_department} accepted.", actor_id=current_user.id)
    write_audit_log(db, user=current_user, action="REFERRAL_ACCEPT", entity_type="referral", entity_id=r.id, request=request)
    db.commit()
    db.refresh(r)
    return serialize_referral(db, r)


@router.post("/{referral_id}/reject", response_model=ReferralOut)
def reject_referral(referral_id: int, payload: ReferralReject, request: Request,
                    current_user: User = Depends(require_perm("referrals:manage")), db: Session = Depends(get_db)):
    r = db.query(Referral).filter(Referral.id == referral_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Referral not found")
    if r.status != "SENT":
        raise HTTPException(status_code=400, detail=f"Cannot reject referral in status {r.status}")
    r.status = "REJECTED"
    r.responded_at = datetime.now(timezone.utc)
    r.notes = (r.notes + " | " if r.notes else "") + f"Rejection reason: {payload.reason}"
    write_audit_log(db, user=current_user, action="REFERRAL_REJECT", entity_type="referral", entity_id=r.id,
                    details=payload.reason, request=request)
    db.commit()
    db.refresh(r)
    return serialize_referral(db, r)


@router.post("/{referral_id}/complete", response_model=ReferralOut)
def complete_referral(referral_id: int, payload: ReferralComplete, request: Request,
                      current_user: User = Depends(require_perm("referrals:manage")), db: Session = Depends(get_db)):
    r = db.query(Referral).filter(Referral.id == referral_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Referral not found")
    if r.status not in ("ACCEPTED", "SENT"):
        raise HTTPException(status_code=400, detail=f"Cannot complete referral in status {r.status}")
    r.status = "COMPLETED"
    r.completed_at = datetime.now(timezone.utc)
    r.notes = (r.notes + " | " if r.notes else "") + f"Outcome: {payload.outcome}"
    write_audit_log(db, user=current_user, action="REFERRAL_COMPLETE", entity_type="referral", entity_id=r.id,
                    details=payload.outcome, request=request)
    db.commit()
    db.refresh(r)
    return serialize_referral(db, r)
