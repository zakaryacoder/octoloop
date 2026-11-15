"""Patient portal (Phase 9). All /portal/* require role=patient + portal:self permission,
scoped strictly to current_user.patient_id. Any cross-access attempt -> 403.
Never expose internal admin notes, other patients, AI medical advice, or the staff dashboard.
"""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.patient import Patient
from app.models.appointment import Appointment
from app.models.referral import Referral
from app.models.case import FollowUpCase
from app.models.notification import Notification
from app.models.audit import SystemSetting
from app.schemas import (
    PortalMe, PortalAppointment, PortalReferral, PortalFollowUp, PortalNotification,
    PortalInstruction, PortalContactInfo,
)

router = APIRouter(prefix="/portal", tags=["portal"])


def _portal_patient(current_user: User) -> Patient:
    """Strict isolation: only patient role with a linked patient_id may proceed."""
    if current_user.role != "patient" or current_user.patient_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="Portal access requires a patient account linked to a patient record.")
    return current_user.patient


@router.get("/me", response_model=PortalMe)
def portal_me(current_user: User = Depends(get_current_user)):
    p = _portal_patient(current_user)
    return PortalMe(
        mrn=p.mrn, first_name=p.first_name, last_name=p.last_name,
        date_of_birth=p.date_of_birth, gender=p.gender, phone=p.phone, email=p.email,
    )


@router.get("/appointments", response_model=list[PortalAppointment])
def portal_appointments(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    p = _portal_patient(current_user)
    appts = db.query(Appointment).filter(Appointment.patient_id == p.id).order_by(Appointment.scheduled_at.desc()).all()
    result = []
    for a in appts:
        clinician = db.query(User).filter(User.id == a.clinician_id).first() if a.clinician_id else None
        result.append(PortalAppointment(
            department=a.department,
            clinician_name=(clinician.full_name or clinician.username) if clinician else "",
            scheduled_at=a.scheduled_at, status=a.status,
        ))
    return result


@router.get("/referrals", response_model=list[PortalReferral])
def portal_referrals(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    p = _portal_patient(current_user)
    refs = db.query(Referral).filter(Referral.patient_id == p.id).order_by(Referral.created_at.desc()).all()
    # No internal notes exposed.
    return [PortalReferral(to_department=r.to_department, status=r.status, reason=r.reason) for r in refs]


@router.get("/follow-ups", response_model=list[PortalFollowUp])
def portal_follow_ups(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    p = _portal_patient(current_user)
    cases = (
        db.query(FollowUpCase)
        .filter(FollowUpCase.patient_id == p.id, FollowUpCase.status != "CLOSED")
        .order_by(FollowUpCase.created_at.desc())
        .all()
    )
    # No internal notes/events exposed.
    return [PortalFollowUp(
        case_ref=c.case_ref, screening_type=c.screening_type, status=c.status,
        next_action=c.next_action, due_date=c.due_date,
    ) for c in cases]


@router.get("/notifications", response_model=list[PortalNotification])
def portal_notifications(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    p = _portal_patient(current_user)
    items = (
        db.query(Notification)
        .filter(Notification.audience == "PATIENT", Notification.patient_id == p.id)
        .order_by(Notification.created_at.desc())
        .all()
    )
    return [PortalNotification(subject=n.subject, message=n.message, channel=n.channel, created_at=n.created_at)
            for n in items]


@router.get("/instructions", response_model=list[PortalInstruction])
def portal_instructions(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    p = _portal_patient(current_user)
    return [PortalInstruction(instruction=i.instruction, created_at=i.created_at)
            for i in sorted(p.instructions, key=lambda x: x.created_at, reverse=True)]


@router.get("/contact-info", response_model=PortalContactInfo)
def portal_contact_info(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _portal_patient(current_user)
    def _setting(key: str, default: str) -> str:
        row = db.query(SystemSetting).filter(SystemSetting.key == key).first()
        return row.value if row else default
    return PortalContactInfo(
        facility_name=_setting("org_name", "OCTOLOOP Clinic"),
        phone=_setting("facility_phone", "+1-555-0100"),
        email=_setting("facility_email", "clinic@octoloop.local"),
        hours=_setting("facility_hours", "Mon-Fri 08:00-17:00"),
    )
