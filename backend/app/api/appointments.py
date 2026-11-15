from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_perm, write_audit_log
from app.models.user import User
from app.models.patient import Patient
from app.models.appointment import Appointment
from app.models.case import FollowUpCase
from app.schemas import (
    AppointmentCreate, AppointmentUpdate, AppointmentCancel, AppointmentComplete, AppointmentOut, Paginated,
)
from app.services.common import paginate, add_case_event
from app.services.serializers import serialize_appointment

router = APIRouter(prefix="/appointments", tags=["appointments"])


@router.get("", response_model=Paginated[AppointmentOut])
def list_appointments(
    date_from: str = Query(None), date_to: str = Query(None), status: str = Query(None),
    patient_id: int = Query(None), case_id: int = Query(None),
    page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_perm("appointments:read")), db: Session = Depends(get_db),
):
    q = db.query(Appointment)
    if date_from:
        q = q.filter(Appointment.scheduled_at >= date_from)
    if date_to:
        q = q.filter(Appointment.scheduled_at <= date_to + "T23:59:59")
    if status:
        q = q.filter(Appointment.status == status)
    if patient_id:
        q = q.filter(Appointment.patient_id == patient_id)
    if case_id:
        q = q.filter(Appointment.case_id == case_id)
    q = q.order_by(Appointment.scheduled_at.desc())
    items, total, p, ps, pages = paginate(q, page, page_size)
    return Paginated[AppointmentOut](items=[serialize_appointment(db, a) for a in items], total=total, page=p, page_size=ps, pages=pages)


@router.post("", response_model=AppointmentOut, status_code=201)
def create_appointment(payload: AppointmentCreate, request: Request,
                       current_user: User = Depends(require_perm("appointments:create")), db: Session = Depends(get_db)):
    if not db.query(Patient).filter(Patient.id == payload.patient_id).first():
        raise HTTPException(status_code=404, detail="Patient not found")
    a = Appointment(
        patient_id=payload.patient_id, case_id=payload.case_id, referral_id=payload.referral_id,
        department=payload.department, clinician_id=payload.clinician_id,
        scheduled_at=payload.scheduled_at, duration_min=payload.duration_min or 30,
        status="SCHEDULED", notes=payload.notes or "",
    )
    db.add(a)
    db.flush()
    if payload.case_id:
        case = db.query(FollowUpCase).filter(FollowUpCase.id == payload.case_id).first()
        if case:
            add_case_event(db, case, event_type="APPOINTMENT_SCHEDULED",
                           note=f"Appointment at {a.department} scheduled for {a.scheduled_at.isoformat()}.",
                           actor_id=current_user.id)
            if case.status in ("REFERRAL_PENDING", "APPOINTMENT_PENDING"):
                case.status = "APPOINTMENT_PENDING"
    write_audit_log(db, user=current_user, action="APPOINTMENT_CREATE", entity_type="appointment", entity_id=a.id,
                    details=f"Appointment at {a.department}", request=request)
    db.commit()
    db.refresh(a)
    return serialize_appointment(db, a)


@router.put("/{appointment_id}", response_model=AppointmentOut)
def reschedule_appointment(appointment_id: int, payload: AppointmentUpdate, request: Request,
                           current_user: User = Depends(require_perm("appointments:manage")), db: Session = Depends(get_db)):
    a = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Appointment not found")
    old = a.scheduled_at.isoformat()
    a.scheduled_at = payload.scheduled_at
    a.status = "RESCHEDULED"
    a.notes = (a.notes + " | " if a.notes else "") + f"Rescheduled from {old}. {payload.notes or ''}"
    if a.case_id:
        case = db.query(FollowUpCase).filter(FollowUpCase.id == a.case_id).first()
        if case:
            add_case_event(db, case, event_type="APPOINTMENT_SCHEDULED",
                           note=f"Appointment rescheduled to {a.scheduled_at.isoformat()}.", actor_id=current_user.id)
    write_audit_log(db, user=current_user, action="APPOINTMENT_RESCHEDULE", entity_type="appointment", entity_id=a.id,
                    request=request)
    db.commit()
    db.refresh(a)
    return serialize_appointment(db, a)


@router.post("/{appointment_id}/cancel", response_model=AppointmentOut)
def cancel_appointment(appointment_id: int, payload: AppointmentCancel, request: Request,
                       current_user: User = Depends(require_perm("appointments:manage")), db: Session = Depends(get_db)):
    a = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Appointment not found")
    if a.status in ("COMPLETED", "CANCELLED"):
        raise HTTPException(status_code=400, detail=f"Cannot cancel appointment in status {a.status}")
    a.status = "CANCELLED"
    a.notes = (a.notes + " | " if a.notes else "") + f"Cancellation reason: {payload.reason}"
    write_audit_log(db, user=current_user, action="APPOINTMENT_CANCEL", entity_type="appointment", entity_id=a.id,
                    details=payload.reason, request=request)
    db.commit()
    db.refresh(a)
    return serialize_appointment(db, a)


@router.post("/{appointment_id}/complete", response_model=AppointmentOut)
def complete_appointment(appointment_id: int, payload: AppointmentComplete, request: Request,
                         current_user: User = Depends(require_perm("appointments:manage")), db: Session = Depends(get_db)):
    a = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Appointment not found")
    if a.status in ("COMPLETED", "NO_SHOW", "CANCELLED"):
        raise HTTPException(status_code=400, detail=f"Cannot complete appointment in status {a.status}")
    a.status = "COMPLETED" if payload.attended else "NO_SHOW"
    a.attended_at = datetime.now(timezone.utc) if payload.attended else None
    if payload.notes:
        a.notes = (a.notes + " | " if a.notes else "") + payload.notes
    if payload.attended and a.case_id:
        case = db.query(FollowUpCase).filter(FollowUpCase.id == a.case_id).first()
        if case and case.status != "CLOSED":
            add_case_event(db, case, event_type="APPOINTMENT_COMPLETED",
                           note=f"Consultation completed at {a.department}.", actor_id=current_user.id)
            case.status = "CONSULTATION_COMPLETED"
            add_case_event(db, case, event_type="STATUS_CHANGE",
                           note="Consultation completed; status -> CONSULTATION_COMPLETED.", actor_id=current_user.id)
    write_audit_log(db, user=current_user, action="APPOINTMENT_COMPLETE", entity_type="appointment", entity_id=a.id,
                    details=f"attended={payload.attended}", request=request)
    db.commit()
    db.refresh(a)
    return serialize_appointment(db, a)
