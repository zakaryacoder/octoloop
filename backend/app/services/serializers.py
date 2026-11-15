"""ORM -> dict serializers matching the API contract shapes (computed fields included)."""
from datetime import date, datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app.models.case import FollowUpCase
from app.models.screening import Screening
from app.models.referral import Referral
from app.models.appointment import Appointment
from app.models.patient import Patient
from app.models.user import User
from app.services.common import patient_name, user_name, is_case_overdue, is_actionable


def _dt(v):
    return v


def serialize_patient(p: Patient) -> dict:
    return {
        "id": p.id, "mrn": p.mrn, "first_name": p.first_name, "last_name": p.last_name,
        "date_of_birth": p.date_of_birth, "gender": p.gender, "phone": p.phone,
        "email": p.email, "address": p.address, "primary_clinician_id": p.primary_clinician_id,
        "medical_history_summary": p.medical_history_summary, "allergies": p.allergies,
        "created_at": p.created_at, "updated_at": p.updated_at,
    }


def serialize_screening(db: Session, s: Screening) -> dict:
    pname = patient_name(s.patient) if s.patient else ""
    return {
        "id": s.id, "patient_id": s.patient_id, "patient_name": pname, "type": s.type,
        "screening_date": s.screening_date, "facility": s.facility, "performed_by": s.performed_by,
        "result_classification": s.result_classification, "result_summary": s.result_summary,
        "actionable": is_actionable(s.result_classification) if s.result_classification else False,
        "assigned_clinician_id": s.assigned_clinician_id, "created_at": s.created_at,
    }


def serialize_case(db: Session, c: FollowUpCase, today: Optional[date] = None) -> dict:
    today = today or datetime.now(timezone.utc).date()
    resp = db.query(User).filter(User.id == c.responsible_id).first() if c.responsible_id else None
    return {
        "id": c.id, "case_ref": c.case_ref, "patient_id": c.patient_id,
        "patient_name": patient_name(c.patient) if c.patient else "",
        "screening_id": c.screening_id, "screening_type": c.screening_type,
        "result_classification": c.result_classification, "priority": c.priority,
        "responsible_id": c.responsible_id, "responsible_name": user_name(resp),
        "status": c.status, "due_date": c.due_date, "last_contact_at": c.last_contact_at,
        "next_action": c.next_action, "created_at": c.created_at, "updated_at": c.updated_at,
        "overdue": is_case_overdue(c, today),
    }


def serialize_referral(db: Session, r: Referral) -> dict:
    return {
        "id": r.id, "patient_id": r.patient_id,
        "patient_name": patient_name(r.patient) if r.patient else "",
        "case_id": r.case_id, "from_department": r.from_department, "to_department": r.to_department,
        "reason": r.reason, "status": r.status, "sent_at": r.sent_at, "responded_at": r.responded_at,
        "completed_at": r.completed_at, "notes": r.notes,
    }


def serialize_appointment(db: Session, a: Appointment) -> dict:
    return {
        "id": a.id, "patient_id": a.patient_id,
        "patient_name": patient_name(a.patient) if a.patient else "",
        "case_id": a.case_id, "referral_id": a.referral_id, "department": a.department,
        "clinician_id": a.clinician_id, "scheduled_at": a.scheduled_at, "duration_min": a.duration_min,
        "status": a.status, "notes": a.notes, "attended_at": a.attended_at,
    }
