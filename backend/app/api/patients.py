from fastapi import APIRouter, Depends, HTTPException, Request, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.deps import get_current_user, require_perm, write_audit_log
from app.models.user import User
from app.models.patient import Patient, PatientInstruction
from app.schemas import (
    PatientCreate, PatientUpdate, PatientOut, PatientDetail, Paginated,
    PatientInstructionCreate, PatientInstructionOut,
)
from app.services.common import paginate
from app.services.serializers import serialize_patient, serialize_screening, serialize_case, serialize_referral, serialize_appointment

router = APIRouter(prefix="/patients", tags=["patients"])


@router.get("", response_model=Paginated[PatientOut])
def list_patients(
    search: str = Query("", description="Search by name, MRN, email, phone"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_perm("patients:read")),
    db: Session = Depends(get_db),
):
    q = db.query(Patient)
    if search:
        like = f"%{search}%"
        q = q.filter(or_(
            Patient.first_name.ilike(like), Patient.last_name.ilike(like),
            Patient.mrn.ilike(like), Patient.email.ilike(like), Patient.phone.ilike(like),
        ))
    q = q.order_by(Patient.id.desc())
    items, total, p, ps, pages = paginate(q, page, page_size)
    return Paginated[PatientOut](items=[serialize_patient(p) for p in items], total=total, page=p, page_size=ps, pages=pages)


@router.post("", response_model=PatientOut, status_code=201)
def create_patient(payload: PatientCreate, request: Request,
                   current_user: User = Depends(require_perm("patients:create")), db: Session = Depends(get_db)):
    if db.query(Patient).filter(Patient.mrn == payload.mrn).first():
        raise HTTPException(status_code=409, detail=f"MRN {payload.mrn} already exists")
    p = Patient(**payload.model_dump())
    db.add(p)
    db.flush()
    write_audit_log(db, user=current_user, action="PATIENT_CREATE", entity_type="patient", entity_id=p.id,
                    details=f"Created patient MRN={p.mrn}", request=request)
    db.commit()
    db.refresh(p)
    return serialize_patient(p)


@router.get("/{patient_id}", response_model=PatientDetail)
def get_patient(patient_id: int, current_user: User = Depends(require_perm("patients:read")), db: Session = Depends(get_db)):
    p = db.query(Patient).filter(Patient.id == patient_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Patient not found")
    data = serialize_patient(p)
    data["screenings"] = [serialize_screening(db, s) for s in p.screenings]
    data["follow_up_cases"] = [serialize_case(db, c) for c in p.follow_up_cases]
    data["referrals"] = [serialize_referral(db, r) for r in p.referrals]
    data["appointments"] = [serialize_appointment(db, a) for a in p.appointments]
    return data


@router.put("/{patient_id}", response_model=PatientOut)
def update_patient(patient_id: int, payload: PatientUpdate, request: Request,
                   current_user: User = Depends(require_perm("patients:update")), db: Session = Depends(get_db)):
    p = db.query(Patient).filter(Patient.id == patient_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Patient not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(p, k, v)
    write_audit_log(db, user=current_user, action="PATIENT_UPDATE", entity_type="patient", entity_id=p.id,
                    details="Updated patient", request=request)
    db.commit()
    db.refresh(p)
    return serialize_patient(p)


@router.post("/{patient_id}/instructions", response_model=PatientInstructionOut, status_code=201)
def add_patient_instruction(patient_id: int, payload: PatientInstructionCreate, request: Request,
                            current_user: User = Depends(require_perm("patients:update")), db: Session = Depends(get_db)):
    """V2: staff-entered, patient-facing instruction (visible read-only in /portal/instructions)."""
    p = db.query(Patient).filter(Patient.id == patient_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Patient not found")
    instr = PatientInstruction(patient_id=p.id, instruction=payload.instruction, entered_by=current_user.id)
    db.add(instr)
    db.flush()
    write_audit_log(db, user=current_user, action="PATIENT_INSTRUCTION", entity_type="patient", entity_id=p.id,
                    details="Added patient-facing instruction", request=request)
    db.commit()
    db.refresh(instr)
    return instr
