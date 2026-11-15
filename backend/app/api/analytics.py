from datetime import datetime, timezone
from statistics import median

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_perm
from app.models.user import User
from app.models.screening import Screening
from app.models.case import FollowUpCase
from app.models.referral import Referral
from app.models.appointment import Appointment
from app.models.notification import Notification
from app.schemas import (
    AnalyticsOverview, ScreeningVolumeRow, TimelinessRow, LostFollowupRow,
)
from app.services.common import is_case_overdue, ensure_aware

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/overview", response_model=AnalyticsOverview)
def overview(current_user: User = Depends(require_perm("cases:read")), db: Session = Depends(get_db)):
    screenings = db.query(Screening).all()
    screening_volume = len(screenings)
    abnormal = sum(1 for s in screenings if s.result_classification == "ABNORMAL")
    abnormal_rate = round(100.0 * abnormal / screening_volume, 1) if screening_volume else 0.0

    cases = db.query(FollowUpCase).all()
    total_cases = len(cases)
    closed = [c for c in cases if c.status == "CLOSED"]
    follow_up_completion_rate = round(100.0 * len(closed) / total_cases, 1) if total_cases else 0.0
    open_cases = [c for c in cases if c.status != "CLOSED"]
    overdue = sum(1 for c in open_cases if is_case_overdue(c))
    overdue_rate = round(100.0 * overdue / total_cases, 1) if total_cases else 0.0

    # avg days screening -> notification (first NOTIFICATION_SENT event or case.last_contact_at)
    notif_deltas = []
    consult_deltas = []
    for c in cases:
        if not c.screening_id:
            continue
        scr = db.query(Screening).filter(Screening.id == c.screening_id).first()
        if not scr:
            continue
        sdate = datetime.combine(scr.screening_date, datetime.min.time(), tzinfo=timezone.utc)
        notif = db.query(Notification).filter(Notification.case_id == c.id).order_by(Notification.sent_at.asc()).first()
        if notif and notif.sent_at:
            notif_deltas.append((ensure_aware(notif.sent_at) - sdate).days)
        appt = db.query(Appointment).filter(Appointment.case_id == c.id, Appointment.attended_at.isnot(None)).order_by(Appointment.attended_at.asc()).first()
        if appt and appt.attended_at:
            consult_deltas.append((ensure_aware(appt.attended_at) - sdate).days)

    avg_notif = round(sum(notif_deltas) / len(notif_deltas), 1) if notif_deltas else 0.0
    avg_consult = round(sum(consult_deltas) / len(consult_deltas), 1) if consult_deltas else 0.0

    referrals = db.query(Referral).all()
    ref_completed = sum(1 for r in referrals if r.status == "COMPLETED")
    referral_completion_rate = round(100.0 * ref_completed / len(referrals), 1) if referrals else 0.0

    lost = sum(1 for c in closed if c.closure_reason == "LOST_TO_FOLLOWUP")

    return AnalyticsOverview(
        screening_volume=screening_volume, abnormal_rate=abnormal_rate,
        follow_up_completion_rate=follow_up_completion_rate,
        avg_days_screening_to_notification=avg_notif,
        avg_days_screening_to_consultation=avg_consult,
        overdue_rate=overdue_rate, referral_completion_rate=referral_completion_rate,
        lost_to_follow_up_count=lost,
    )


@router.get("/screening-volume", response_model=list[ScreeningVolumeRow])
def screening_volume(months: int = Query(12, ge=1, le=36),
                     current_user: User = Depends(require_perm("cases:read")), db: Session = Depends(get_db)):
    screenings = db.query(Screening).all()
    month_map: dict = {}
    for s in screenings:
        if not s.screening_date:
            continue
        m = s.screening_date.strftime("%Y-%m")
        e = month_map.setdefault(m, {"total": 0, "abnormal": 0, "actionable": 0})
        e["total"] += 1
        if s.result_classification == "ABNORMAL":
            e["abnormal"] += 1
        if s.result_classification in ("ABNORMAL", "BORDERLINE"):
            e["actionable"] += 1
    rows = [
        ScreeningVolumeRow(month=m, total=v["total"], abnormal=v["abnormal"], actionable=v["actionable"])
        for m, v in sorted(month_map.items(), reverse=True)[:months]
    ]
    return rows


@router.get("/timeliness", response_model=list[TimelinessRow])
def timeliness(current_user: User = Depends(require_perm("cases:read")), db: Session = Depends(get_db)):
    types = ["BREAST", "CERVICAL", "COLORECTAL", "DIABETES", "HYPERTENSION", "OTHER"]
    rows = []
    for stype in types:
        notif_deltas = []
        consult_deltas = []
        closure_deltas = []
        cases = db.query(FollowUpCase).filter(FollowUpCase.screening_type == stype).all()
        for c in cases:
            if c.screening_id:
                scr = db.query(Screening).filter(Screening.id == c.screening_id).first()
                if scr and scr.screening_date:
                    sdate = datetime.combine(scr.screening_date, datetime.min.time(), tzinfo=timezone.utc)
                    notif = db.query(Notification).filter(Notification.case_id == c.id).order_by(Notification.sent_at.asc()).first()
                    if notif and notif.sent_at:
                        notif_deltas.append((ensure_aware(notif.sent_at) - sdate).days)
                    appt = db.query(Appointment).filter(Appointment.case_id == c.id, Appointment.attended_at.isnot(None)).order_by(Appointment.attended_at.asc()).first()
                    if appt and appt.attended_at:
                        consult_deltas.append((ensure_aware(appt.attended_at) - sdate).days)
            if c.status == "CLOSED" and c.closed_at and c.created_at:
                closure_deltas.append((ensure_aware(c.closed_at) - ensure_aware(c.created_at)).days)
        if not cases:
            continue
        rows.append(TimelinessRow(
            screening_type=stype,
            avg_days_to_notification=round(sum(notif_deltas) / len(notif_deltas), 1) if notif_deltas else 0.0,
            avg_days_to_consultation=round(sum(consult_deltas) / len(consult_deltas), 1) if consult_deltas else 0.0,
            median_days_to_closure=round(float(median(closure_deltas)), 1) if closure_deltas else 0.0,
        ))
    return rows


@router.get("/lost-to-followup", response_model=list[LostFollowupRow])
def lost_to_followup(current_user: User = Depends(require_perm("cases:read")), db: Session = Depends(get_db)):
    closed = db.query(FollowUpCase).filter(FollowUpCase.status == "CLOSED").all()
    reason_map: dict = {}
    for c in closed:
        r = c.closure_reason or "UNKNOWN"
        reason_map[r] = reason_map.get(r, 0) + 1
    return [LostFollowupRow(reason=k, count=v) for k, v in sorted(reason_map.items(), key=lambda kv: -kv[1])]
