from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_perm
from app.models.user import User
from app.models.patient import Patient
from app.models.screening import Screening
from app.models.case import FollowUpCase, CaseEvent
from app.models.referral import Referral
from app.models.appointment import Appointment
from app.models.audit import AuditLog
from app.schemas import (
    DashboardSummary, ScreeningVolumeMonth, CasesByStatusItem,
    OverdueByResponsibleItem, RecentActivityItem,
)
from app.services.common import is_case_overdue, user_name, patient_name
from app.services.escalation import run_escalation_checks

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=DashboardSummary)
def dashboard_summary(current_user: User = Depends(require_perm("cases:read")), db: Session = Depends(get_db)):
    run_escalation_checks(db)
    today = datetime.now(timezone.utc).date()

    total_patients = db.query(func.count(Patient.id)).scalar() or 0
    total_screenings = db.query(func.count(Screening.id)).scalar() or 0
    abnormal_results = db.query(func.count(Screening.id)).filter(Screening.result_classification == "ABNORMAL").scalar() or 0

    open_cases = db.query(FollowUpCase).filter(FollowUpCase.status != "CLOSED").all()
    open_follow_up_cases = len(open_cases)
    overdue_cases = sum(1 for c in open_cases if is_case_overdue(c, today))
    completed_follow_ups = db.query(func.count(FollowUpCase.id)).filter(FollowUpCase.status == "CLOSED").scalar() or 0
    total_cases = open_follow_up_cases + completed_follow_ups
    follow_up_completion_rate = round(100.0 * completed_follow_ups / total_cases, 1) if total_cases else 0.0

    actionable = db.query(func.count(Screening.id)).filter(Screening.result_classification.in_(["ABNORMAL", "BORDERLINE"])).scalar() or 0
    screening_to_care_conversion_rate = round(100.0 * total_cases / actionable, 1) if actionable else 0.0

    pending_referrals = db.query(func.count(Referral.id)).filter(Referral.status.in_(["DRAFT", "SENT"])).scalar() or 0
    upcoming_appointments = db.query(func.count(Appointment.id)).filter(
        Appointment.status.in_(["SCHEDULED", "CONFIRMED", "CHECKED_IN"]),
        Appointment.scheduled_at >= datetime.now(timezone.utc),
    ).scalar() or 0

    # screening_volume_by_month (last 6 months, computed in Python for DB portability)
    all_screenings = db.query(Screening.screening_date, Screening.result_classification).all()
    month_map: dict = {}
    for sdate, rclass in all_screenings:
        if sdate is None:
            continue
        m = sdate.strftime("%Y-%m")
        entry = month_map.setdefault(m, {"total": 0, "abnormal": 0})
        entry["total"] += 1
        if rclass == "ABNORMAL":
            entry["abnormal"] += 1
    screening_volume_by_month = [
        ScreeningVolumeMonth(month=m, total=v["total"], abnormal=v["abnormal"])
        for m, v in sorted(month_map.items(), reverse=True)[:6]
    ]

    # cases_by_status
    status_rows = db.query(FollowUpCase.status, func.count(FollowUpCase.id)).group_by(FollowUpCase.status).all()
    cases_by_status = [CasesByStatusItem(status=s, count=c) for s, c in status_rows]

    # overdue_by_responsible
    overdue_by_resp: dict = {}
    for c in open_cases:
        if is_case_overdue(c, today):
            resp = db.query(User).filter(User.id == c.responsible_id).first() if c.responsible_id else None
            key = user_name(resp) if resp else "Unassigned"
            overdue_by_resp[key] = overdue_by_resp.get(key, 0) + 1
    overdue_by_responsible = [OverdueByResponsibleItem(responsible=k, count=v) for k, v in sorted(overdue_by_resp.items(), key=lambda kv: -kv[1])]

    # recent_activity from audit logs + case events
    events = db.query(CaseEvent).order_by(CaseEvent.created_at.desc()).limit(10).all()
    recent_activity = []
    for e in events:
        case = db.query(FollowUpCase).filter(FollowUpCase.id == e.case_id).first()
        pname = patient_name(case.patient) if case and case.patient else ""
        actor = db.query(User).filter(User.id == e.actor_id).first()
        recent_activity.append(RecentActivityItem(
            id=e.id, timestamp=e.created_at,
            actor=user_name(actor) if actor else "system",
            action=e.event_type, patient_name=pname, case_id=e.case_id,
        ))

    return DashboardSummary(
        total_patients=total_patients, total_screenings=total_screenings,
        abnormal_results=abnormal_results, open_follow_up_cases=open_follow_up_cases,
        overdue_cases=overdue_cases, completed_follow_ups=completed_follow_ups,
        pending_referrals=pending_referrals, upcoming_appointments=upcoming_appointments,
        follow_up_completion_rate=follow_up_completion_rate,
        screening_to_care_conversion_rate=screening_to_care_conversion_rate,
        screening_volume_by_month=screening_volume_by_month,
        cases_by_status=cases_by_status, overdue_by_responsible=overdue_by_responsible,
        recent_activity=recent_activity,
    )
