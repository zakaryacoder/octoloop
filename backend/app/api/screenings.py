from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_perm, write_audit_log
from app.models.user import User
from app.models.patient import Patient
from app.models.screening import Screening, ScreeningResult
from app.models.case import FollowUpCase
from app.schemas import (
    ScreeningCreate, ScreeningResultCreate, ScreeningAssign,
    ScreeningOut, ScreeningWithCaseResponse, Paginated,
)
from app.services.common import paginate, derive_priority, generate_case_ref, add_case_event, is_actionable
from app.services.serializers import serialize_screening, serialize_case

router = APIRouter(prefix="/screenings", tags=["screenings"])


@router.get("", response_model=Paginated[ScreeningOut])
def list_screenings(
    patient_id: int = Query(None), type: str = Query(None), classification: str = Query(None),
    page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_perm("screenings:read")), db: Session = Depends(get_db),
):
    q = db.query(Screening)
    if patient_id:
        q = q.filter(Screening.patient_id == patient_id)
    if type:
        q = q.filter(Screening.type == type)
    if classification:
        q = q.filter(Screening.result_classification == classification)
    q = q.order_by(Screening.screening_date.desc(), Screening.id.desc())
    items, total, p, ps, pages = paginate(q, page, page_size)
    return Paginated[ScreeningOut](items=[serialize_screening(db, s) for s in items], total=total, page=p, page_size=ps, pages=pages)


@router.post("", response_model=ScreeningOut, status_code=201)
def create_screening(payload: ScreeningCreate, request: Request,
                     current_user: User = Depends(require_perm("screenings:create")), db: Session = Depends(get_db)):
    if not db.query(Patient).filter(Patient.id == payload.patient_id).first():
        raise HTTPException(status_code=404, detail="Patient not found")
    s = Screening(**payload.model_dump())
    db.add(s)
    db.flush()
    write_audit_log(db, user=current_user, action="SCREENING_CREATE", entity_type="screening", entity_id=s.id,
                    details=f"Created {s.type} screening for patient {s.patient_id}", request=request)
    db.commit()
    db.refresh(s)
    return serialize_screening(db, s)


@router.post("/{screening_id}/result", response_model=ScreeningWithCaseResponse)
def record_result(screening_id: int, payload: ScreeningResultCreate, request: Request,
                  current_user: User = Depends(require_perm("screenings:record")), db: Session = Depends(get_db)):
    s = db.query(Screening).filter(Screening.id == screening_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Screening not found")
    recorded_by = payload.recorded_by or current_user.id
    sr = ScreeningResult(
        screening_id=s.id, result_classification=payload.result_classification,
        result_summary=payload.result_summary, recorded_by=recorded_by,
        recorded_at=datetime.now(timezone.utc),
    )
    db.add(sr)
    s.result_classification = payload.result_classification
    s.result_summary = payload.result_summary
    db.flush()

    created_case = None
    if is_actionable(payload.result_classification):
        existing = (
            db.query(FollowUpCase)
            .filter(FollowUpCase.screening_id == s.id, FollowUpCase.status != "CLOSED")
            .first()
        )
        if not existing:
            from datetime import timedelta
            case = FollowUpCase(
                case_ref=generate_case_ref(db),
                patient_id=s.patient_id,
                screening_id=s.id,
                screening_type=s.type,
                result_classification=payload.result_classification,
                priority=derive_priority(payload.result_classification),
                responsible_id=s.assigned_clinician_id,
                status="NEW_RESULT",
                due_date=datetime.now(timezone.utc).date() + timedelta(days=14),
                next_action="Review abnormal/borderline screening result",
            )
            db.add(case)
            db.flush()
            add_case_event(db, case, event_type="CASE_CREATED",
                           note=f"Auto-created from actionable {payload.result_classification} screening result.",
                           actor_id=current_user.id)
            add_case_event(db, case, event_type="RESULT_RECORDED", note=payload.result_summary, actor_id=recorded_by)
            created_case = serialize_case(db, case)

    write_audit_log(db, user=current_user, action="SCREENING_RESULT", entity_type="screening", entity_id=s.id,
                    details=f"Recorded result {payload.result_classification}" +
                            (f"; auto-created case {created_case['case_ref']}" if created_case else ""),
                    request=request)
    db.commit()
    db.refresh(s)
    return ScreeningWithCaseResponse(screening=serialize_screening(db, s), created_case=created_case)


@router.post("/{screening_id}/assign", response_model=ScreeningOut)
def assign_screening(screening_id: int, payload: ScreeningAssign, request: Request,
                     current_user: User = Depends(require_perm("screenings:assign")), db: Session = Depends(get_db)):
    s = db.query(Screening).filter(Screening.id == screening_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Screening not found")
    clinician = db.query(User).filter(User.id == payload.clinician_id, User.is_active == True).first()
    if not clinician:
        raise HTTPException(status_code=404, detail="Clinician not found")
    s.assigned_clinician_id = clinician.id
    write_audit_log(db, user=current_user, action="SCREENING_ASSIGN", entity_type="screening", entity_id=s.id,
                    details=f"Assigned to user {clinician.id}", request=request)
    db.commit()
    db.refresh(s)
    return serialize_screening(db, s)
