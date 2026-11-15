"""Shared helpers used across routers and services."""
from datetime import date, datetime, timezone
from typing import Optional, Tuple

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.case import FollowUpCase, CaseEvent, CASE_STATUS_ORDER
from app.models.user import User
from app.models.patient import Patient
from app.schemas.enums import Priority, ResultClassification, ACTIONABLE_CLASSIFICATIONS, CaseEventType


def patient_name(patient: Optional[Patient]) -> str:
    if not patient:
        return ""
    return f"{patient.first_name} {patient.last_name}".strip()


def user_name(user: Optional[User]) -> str:
    if not user:
        return ""
    return user.full_name or user.username


def is_case_overdue(case: FollowUpCase, today: Optional[date] = None) -> bool:
    if case.status == "CLOSED" or case.due_date is None:
        return False
    today = today or datetime.now(timezone.utc).date()
    return case.due_date < today


def ensure_aware(dt: Optional[datetime]) -> Optional[datetime]:
    """Normalize datetimes to UTC-aware. SQLite (and some drivers) return naive datetimes
    even when aware ones were stored; subtracting aware vs naive raises TypeError.
    Call this on any DB-read datetime before duration math / comparison with now()."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def derive_priority(classification: str) -> str:
    if classification == ResultClassification.ABNORMAL:
        return str(Priority.HIGH)
    if classification == ResultClassification.BORDERLINE:
        return str(Priority.MEDIUM)
    return str(Priority.LOW)


def is_actionable(classification: str) -> bool:
    return classification in ACTIONABLE_CLASSIFICATIONS


def generate_case_ref(db: Session, year: Optional[int] = None) -> str:
    year = year or datetime.now(timezone.utc).year
    prefix = f"FU-{year}-"
    count = db.query(func.count(FollowUpCase.id)).filter(FollowUpCase.case_ref.like(f"{prefix}%")).scalar() or 0
    return f"{prefix}{count + 1:04d}"


def add_case_event(
    db: Session,
    case: FollowUpCase,
    event_type: str,
    note: str = "",
    actor_id: Optional[int] = None,
    contact_outcome: str = "",
) -> CaseEvent:
    evt = CaseEvent(
        case_id=case.id,
        event_type=event_type,
        note=note,
        actor_id=actor_id,
        contact_outcome=contact_outcome,
    )
    db.add(evt)
    return evt


def validate_status_transition(current: str, target: str, is_admin: bool, note: Optional[str]) -> Tuple[bool, str]:
    """Return (ok, error_message). Skip forward allowed only with admin role or non-empty note."""
    if current == "CLOSED":
        return False, "Case is already closed; use POST /cases to reopen a new case."
    if target == "CLOSED":
        return False, "Use POST /cases/{id}/close to close a case."
    try:
        cur_idx = CASE_STATUS_ORDER.index(current)
        tgt_idx = CASE_STATUS_ORDER.index(target)
    except ValueError:
        return False, f"Unknown status: {target}"
    if tgt_idx <= cur_idx:
        return False, f"Cannot regress from {current} to {target}."
    if tgt_idx > cur_idx + 1 and not is_admin and not note:
        return False, "Skipping statuses requires admin role or a transition note."
    return True, ""


def paginate(query, page: int, page_size: int):
    import math
    page = max(1, page)
    page_size = max(1, min(100, page_size))
    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()
    pages = math.ceil(total / page_size) if total else 0
    return items, total, page, page_size, pages
