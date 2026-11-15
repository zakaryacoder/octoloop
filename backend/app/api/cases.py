from datetime import datetime, timezone, date
from fastapi import APIRouter, Depends, HTTPException, Request, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.deps import get_current_user, require_perm, write_audit_log
from app.models.user import User
from app.models.patient import Patient
from app.models.case import FollowUpCase, CaseEvent
from app.models.screening import Screening
from app.models.escalation import EscalationLog
from app.schemas import (
    CaseCreate, CaseUpdate, CaseAdvance, CaseEventCreate, CaseClose,
    CaseOut, CaseDetail, CaseEventOut, Paginated, EscalationLogOut,
)
from app.services.common import (
    paginate, is_case_overdue, generate_case_ref, add_case_event, validate_status_transition,
)
from app.services.serializers import serialize_case, serialize_referral, serialize_appointment, serialize_screening, serialize_patient
from app.services.escalation import run_escalation_checks

router = APIRouter(prefix="/cases", tags=["cases"])


@router.get("/overdue", response_model=list[CaseOut])
def list_overdue_cases(current_user: User = Depends(require_perm("cases:read")), db: Session = Depends(get_db)):
    run_escalation_checks(db)
    today = datetime.now(timezone.utc).date()
    # V2: overdue computed at SQL level (due_date < today AND status != CLOSED).
    cases = (
        db.query(FollowUpCase)
        .filter(FollowUpCase.status != "CLOSED", FollowUpCase.due_date.isnot(None), FollowUpCase.due_date < today)
        .all()
    )
    return [serialize_case(db, c, today) for c in cases]


@router.get("", response_model=Paginated[CaseOut])
def list_cases(
    status: str = Query(None), priority: str = Query(None), responsible_id: int = Query(None),
    overdue_only: bool = Query(False), patient_id: int = Query(None), search: str = Query(""),
    page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_perm("cases:read")), db: Session = Depends(get_db),
):
    run_escalation_checks(db)
    today = datetime.now(timezone.utc).date()
    q = db.query(FollowUpCase)

    # V2: ALL filters applied at SQL level — including overdue (due_date < today AND status != CLOSED).
    if status:
        q = q.filter(FollowUpCase.status == status)
    if priority:
        q = q.filter(FollowUpCase.priority == priority)
    if responsible_id:
        q = q.filter(FollowUpCase.responsible_id == responsible_id)
    if patient_id:
        q = q.filter(FollowUpCase.patient_id == patient_id)
    if overdue_only:
        q = q.filter(FollowUpCase.status != "CLOSED", FollowUpCase.due_date.isnot(None), FollowUpCase.due_date < today)
    if search:
        like = f"%{search}%"
        q = q.join(Patient, Patient.id == FollowUpCase.patient_id).filter(or_(
            Patient.first_name.ilike(like), Patient.last_name.ilike(like),
            FollowUpCase.case_ref.ilike(like),
        ))

    q = q.order_by(FollowUpCase.created_at.desc())
    # V2: total computed AFTER filtering (paginate calls query.count() on filtered query).
    items, total, p, ps, pages = paginate(q, page, page_size)
    return Paginated[CaseOut](
        items=[serialize_case(db, c, today) for c in items],
        total=total, page=p, page_size=ps, pages=pages,
    )


@router.post("", response_model=CaseOut, status_code=201)
def create_case(payload: CaseCreate, request: Request,
                current_user: User = Depends(require_perm("cases:create")), db: Session = Depends(get_db)):
    if not db.query(Patient).filter(Patient.id == payload.patient_id).first():
        raise HTTPException(status_code=404, detail="Patient not found")
    screening = None
    if payload.screening_id:
        screening = db.query(Screening).filter(Screening.id == payload.screening_id).first()
        if not screening:
            raise HTTPException(status_code=404, detail="Screening not found")
    case = FollowUpCase(
        case_ref=generate_case_ref(db),
        patient_id=payload.patient_id,
        screening_id=payload.screening_id,
        screening_type=screening.type if screening else "",
        result_classification=screening.result_classification if screening else "",
        priority=payload.priority,
        responsible_id=payload.responsible_id,
        status="NEW_RESULT",
        due_date=payload.due_date,
        next_action=payload.next_action,
    )
    db.add(case)
    db.flush()
    add_case_event(db, case, event_type="CASE_CREATED", note="Manually created case.", actor_id=current_user.id)
    write_audit_log(db, user=current_user, action="CASE_CREATE", entity_type="case", entity_id=case.id,
                    details=f"Created case {case.case_ref}", request=request)
    db.commit()
    db.refresh(case)
    return serialize_case(db, case)


@router.get("/{case_id}", response_model=CaseDetail)
def get_case(case_id: int, current_user: User = Depends(require_perm("cases:read")), db: Session = Depends(get_db)):
    case = db.query(FollowUpCase).filter(FollowUpCase.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    run_escalation_checks(db)
    data = serialize_case(db, case)
    data["events"] = [
        CaseEventOut.model_validate(e).model_dump() for e in sorted(case.events, key=lambda e: e.created_at)
    ]
    data["referrals"] = [serialize_referral(db, r) for r in case.referrals]
    data["appointments"] = [serialize_appointment(db, a) for a in case.appointments]
    data["patient"] = serialize_patient(case.patient) if case.patient else None
    data["screening"] = serialize_screening(db, case.screening) if case.screening else None
    return data


@router.get("/{case_id}/escalations", response_model=list[EscalationLogOut])
def list_case_escalations(case_id: int, current_user: User = Depends(require_perm("cases:read")), db: Session = Depends(get_db)):
    """V2: escalation history for a case. Never auto-closes."""
    case = db.query(FollowUpCase).filter(FollowUpCase.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    logs = db.query(EscalationLog).filter(EscalationLog.case_id == case_id).order_by(EscalationLog.created_at.desc()).all()
    return logs


@router.put("/{case_id}", response_model=CaseOut)
def update_case(case_id: int, payload: CaseUpdate, request: Request,
                current_user: User = Depends(require_perm("cases:update")), db: Session = Depends(get_db)):
    case = db.query(FollowUpCase).filter(FollowUpCase.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    changes = payload.model_dump(exclude_unset=True)
    if "responsible_id" in changes and changes["responsible_id"] != case.responsible_id:
        add_case_event(db, case, event_type="ASSIGNMENT_CHANGE",
                       note=f"Responsible changed to user {changes['responsible_id']}.", actor_id=current_user.id)
    for k, v in changes.items():
        setattr(case, k, v)
    write_audit_log(db, user=current_user, action="CASE_UPDATE", entity_type="case", entity_id=case.id,
                    details=f"Updated case {case.case_ref}", request=request)
    db.commit()
    db.refresh(case)
    return serialize_case(db, case)


@router.post("/{case_id}/advance", response_model=CaseOut)
def advance_case(case_id: int, payload: CaseAdvance, request: Request,
                 current_user: User = Depends(require_perm("cases:update")), db: Session = Depends(get_db)):
    case = db.query(FollowUpCase).filter(FollowUpCase.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    is_admin = current_user.role == "admin"
    ok, err = validate_status_transition(case.status, payload.to_status, is_admin, payload.note)
    if not ok:
        raise HTTPException(status_code=400, detail=err)
    old = case.status
    case.status = payload.to_status
    note = payload.note or f"Advanced from {old} to {payload.to_status}."
    add_case_event(db, case, event_type="STATUS_CHANGE", note=note, actor_id=current_user.id)
    write_audit_log(db, user=current_user, action="CASE_ADVANCE", entity_type="case", entity_id=case.id,
                    details=f"{old} -> {payload.to_status}", request=request)
    db.commit()
    db.refresh(case)
    return serialize_case(db, case)


@router.post("/{case_id}/events", response_model=CaseEventOut, status_code=201)
def add_event(case_id: int, payload: CaseEventCreate, request: Request,
              current_user: User = Depends(require_perm("cases:update")), db: Session = Depends(get_db)):
    case = db.query(FollowUpCase).filter(FollowUpCase.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    evt = add_case_event(db, case, event_type=payload.event_type, note=payload.note,
                         actor_id=current_user.id, contact_outcome=payload.contact_outcome or "")
    if payload.event_type == "PATIENT_CONTACT":
        case.last_contact_at = datetime.now(timezone.utc)
    write_audit_log(db, user=current_user, action="CASE_EVENT", entity_type="case", entity_id=case.id,
                    details=f"Event {payload.event_type}", request=request)
    db.commit()
    db.refresh(evt)
    return evt


@router.post("/{case_id}/close", response_model=CaseOut)
def close_case(case_id: int, payload: CaseClose, request: Request,
               current_user: User = Depends(require_perm("cases:close")), db: Session = Depends(get_db)):
    # V2: requires cases:close permission -> 403 for nurse/viewer/patient.
    # Hard boundary: only an authenticated human user (this endpoint) may close a case.
    case = db.query(FollowUpCase).filter(FollowUpCase.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    if case.status == "CLOSED":
        raise HTTPException(status_code=400, detail="Case is already closed")
    case.status = "CLOSED"
    case.closure_reason = payload.closure_reason
    case.closed_at = datetime.now(timezone.utc)
    add_case_event(db, case, event_type="CASE_CLOSED",
                   note=f"Closed by {current_user.username}. Reason: {payload.closure_reason}. {payload.note}",
                   actor_id=current_user.id)
    write_audit_log(db, user=current_user, action="CASE_CLOSE", entity_type="case", entity_id=case.id,
                    details=f"Closed {case.case_ref}: {payload.closure_reason}", request=request)
    db.commit()
    db.refresh(case)
    return serialize_case(db, case)
