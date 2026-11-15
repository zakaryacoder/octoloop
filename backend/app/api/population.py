"""Population Health Intelligence (Phase 5). All endpoints require population:read.
All returns are AGGREGATED and ANONYMIZED — no patient identifiers ever. Labeled operational risk.
"""
import csv
import io
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.deps import require_perm
from app.models.user import User
from app.models.patient import Patient
from app.models.screening import Screening
from app.models.case import FollowUpCase
from app.models.referral import Referral
from app.models.appointment import Appointment
from app.schemas import (
    PopulationOverview, PopulationByType, PopulationCoverageRow, PopulationGeographicRow,
    PopulationDelayedCareRow, PopulationTrendsRow,
)

router = APIRouter(prefix="/population", tags=["population"])

POPULATION_DISCLAIMER = (
    "Operational-only metrics, aggregated & anonymized. Not clinical; not patient-specific."
)


def _region_from_address(address: str) -> str:
    """Synthetic operational region derived from address district. No IDs exposed."""
    if not address:
        return "Unknown"
    for region in ["Downtown", "Northside", "Riverside", "Eastgate", "Westfield"]:
        if region.lower() in address.lower():
            return region
    return "Other"


@router.get("/overview", response_model=PopulationOverview)
def population_overview(current_user: User = Depends(require_perm("population:read")), db: Session = Depends(get_db)):
    total_screenings = db.query(func.count(Screening.id)).scalar() or 0
    abnormal = db.query(func.count(Screening.id)).filter(Screening.result_classification == "ABNORMAL").scalar() or 0
    abnormal_rate = round(100.0 * abnormal / total_screenings, 1) if total_screenings else 0.0

    total_cases = db.query(func.count(FollowUpCase.id)).scalar() or 0
    closed = db.query(func.count(FollowUpCase.id)).filter(FollowUpCase.status == "CLOSED").scalar() or 0
    completion = round(100.0 * closed / total_cases, 1) if total_cases else 0.0

    total_patients = db.query(func.count(Patient.id)).scalar() or 0
    screened_patients = db.query(func.count(func.distinct(Screening.patient_id))).scalar() or 0
    coverage = round(100.0 * screened_patients / total_patients, 1) if total_patients else 0.0

    # avg days screening -> consultation (attended appointment)
    consult_deltas = []
    appts = db.query(Appointment).filter(Appointment.attended_at.isnot(None)).all()
    for a in appts:
        if a.case_id:
            case = db.query(FollowUpCase).filter(FollowUpCase.id == a.case_id).first()
            if case and case.screening_id:
                scr = db.query(Screening).filter(Screening.id == case.screening_id).first()
                if scr and scr.screening_date:
                    sdate = datetime.combine(scr.screening_date, datetime.min.time(), tzinfo=timezone.utc)
                    from app.services.common import ensure_aware
                    consult_deltas.append((ensure_aware(a.attended_at) - sdate).days)
    avg_consult = round(sum(consult_deltas) / len(consult_deltas), 1) if consult_deltas else 0.0

    today = datetime.now(timezone.utc).date()
    from app.services.common import is_case_overdue
    open_cases = db.query(FollowUpCase).filter(FollowUpCase.status != "CLOSED").all()
    delayed = sum(1 for c in open_cases if is_case_overdue(c, today))

    total_refs = db.query(func.count(Referral.id)).scalar() or 0
    ref_completed = db.query(func.count(Referral.id)).filter(Referral.status == "COMPLETED").scalar() or 0
    ref_completion = round(100.0 * ref_completed / total_refs, 1) if total_refs else 0.0

    by_type_rows = []
    for stype in ["BREAST", "CERVICAL", "COLORECTAL", "DIABETES", "HYPERTENSION", "OTHER"]:
        s_count = db.query(func.count(Screening.id)).filter(Screening.type == stype).scalar() or 0
        if s_count == 0:
            continue
        s_abn = db.query(func.count(Screening.id)).filter(
            Screening.type == stype, Screening.result_classification == "ABNORMAL").scalar() or 0
        type_cases = db.query(func.count(FollowUpCase.id)).filter(FollowUpCase.screening_type == stype).scalar() or 0
        type_closed = db.query(func.count(FollowUpCase.id)).filter(
            FollowUpCase.screening_type == stype, FollowUpCase.status == "CLOSED").scalar() or 0
        type_completion = round(100.0 * type_closed / type_cases, 1) if type_cases else 0.0
        by_type_rows.append(PopulationByType(type=stype, screenings=s_count, abnormal=s_abn, completion_rate=type_completion))

    return PopulationOverview(
        screening_coverage_rate=coverage,
        abnormal_rate=abnormal_rate,
        follow_up_completion_rate=completion,
        avg_days_to_consultation=avg_consult,
        delayed_care_count=delayed,
        referral_completion_rate=ref_completion,
        by_type=by_type_rows,
        disclaimer=POPULATION_DISCLAIMER,
    )


@router.get("/coverage", response_model=list[PopulationCoverageRow])
def population_coverage(type: str = Query(None), from_: str = Query(None, alias="from"), to: str = Query(None),
                        current_user: User = Depends(require_perm("population:read")), db: Session = Depends(get_db)):
    q = db.query(Screening.screening_date, Screening.result_classification)
    if type:
        q = q.filter(Screening.type == type)
    rows = q.all()
    month_map: dict = {}
    for sdate, rclass in rows:
        if not sdate:
            continue
        m = sdate.strftime("%Y-%m")
        if from_ and m < from_:
            continue
        if to and m > to:
            continue
        e = month_map.setdefault(m, {"total": 0, "abnormal": 0})
        e["total"] += 1
        if rclass == "ABNORMAL":
            e["abnormal"] += 1
    total_patients = db.query(func.count(Patient.id)).scalar() or 1
    return [
        PopulationCoverageRow(month=m, total=v["total"], abnormal=v["abnormal"],
                              coverage_rate=round(100.0 * v["total"] / total_patients, 1))
        for m, v in sorted(month_map.items(), reverse=True)[:12]
    ]


@router.get("/geographic", response_model=list[PopulationGeographicRow])
def population_geographic(current_user: User = Depends(require_perm("population:read")), db: Session = Depends(get_db)):
    patients = db.query(Patient.id, Patient.address).all()
    patient_region = {pid: _region_from_address(addr) for pid, addr in patients}
    region_map: dict = {}
    screenings = db.query(Screening.patient_id, Screening.result_classification).all()
    for pid, rclass in screenings:
        region = patient_region.get(pid, "Unknown")
        e = region_map.setdefault(region, {"screening_count": 0, "abnormal_count": 0, "cases": 0, "closed": 0, "overdue": 0})
        e["screening_count"] += 1
        if rclass == "ABNORMAL":
            e["abnormal_count"] += 1
    today = datetime.now(timezone.utc).date()
    from app.services.common import is_case_overdue
    cases = db.query(FollowUpCase.patient_id, FollowUpCase.status, FollowUpCase.due_date).all()
    for pid, status, due_date in cases:
        region = patient_region.get(pid, "Unknown")
        e = region_map.setdefault(region, {"screening_count": 0, "abnormal_count": 0, "cases": 0, "closed": 0, "overdue": 0})
        e["cases"] += 1
        if status == "CLOSED":
            e["closed"] += 1
        elif due_date and due_date < today:
            e["overdue"] += 1
    result = []
    for region, e in sorted(region_map.items()):
        completion = round(100.0 * e["closed"] / e["cases"], 1) if e["cases"] else 0.0
        overdue_rate = round(100.0 * e["overdue"] / max(e["cases"] - e["closed"], 1), 1)
        result.append(PopulationGeographicRow(
            region=region, screening_count=e["screening_count"], abnormal_count=e["abnormal_count"],
            completion_rate=completion, overdue_rate=overdue_rate,
        ))
    return result


@router.get("/delayed-care", response_model=list[PopulationDelayedCareRow])
def population_delayed_care(current_user: User = Depends(require_perm("population:read")), db: Session = Depends(get_db)):
    today = datetime.now(timezone.utc).date()
    from app.services.common import is_case_overdue
    open_cases = db.query(FollowUpCase).filter(FollowUpCase.status != "CLOSED").all()
    buckets = {"0-7": 0, "8-14": 0, "15-30": 0, "31+": 0}
    by_type: dict = {}
    for c in open_cases:
        if not is_case_overdue(c, today):
            continue
        days = (today - c.due_date).days
        bucket = "0-7" if days <= 7 else "8-14" if days <= 14 else "15-30" if days <= 30 else "31+"
        key = (c.screening_type or "OTHER", bucket)
        by_type[key] = by_type.get(key, 0) + 1
    return [
        PopulationDelayedCareRow(screening_type=stype, bucket_days=bucket, count=count)
        for (stype, bucket), count in sorted(by_type.items())
    ]


@router.get("/trends", response_model=list[PopulationTrendsRow])
def population_trends(months: int = Query(12, ge=1, le=36),
                      current_user: User = Depends(require_perm("population:read")), db: Session = Depends(get_db)):
    screenings = db.query(Screening.screening_date, Screening.result_classification).all()
    month_map: dict = {}
    for sdate, rclass in screenings:
        if not sdate:
            continue
        m = sdate.strftime("%Y-%m")
        e = month_map.setdefault(m, {"screenings": 0, "abnormal": 0})
        e["screenings"] += 1
        if rclass == "ABNORMAL":
            e["abnormal"] += 1
    # case closure by month (closed_at)
    closed_by_month: dict = {}
    cases = db.query(FollowUpCase.closed_at, FollowUpCase.status).all()
    for closed_at, status in cases:
        if status == "CLOSED" and closed_at:
            from app.services.common import ensure_aware
            m = ensure_aware(closed_at).strftime("%Y-%m")
            closed_by_month[m] = closed_by_month.get(m, 0) + 1
    today = datetime.now(timezone.utc).date()
    from app.services.common import is_case_overdue
    overdue_count = sum(1 for c in db.query(FollowUpCase).filter(FollowUpCase.status != "CLOSED").all() if is_case_overdue(c, today))
    rows = []
    for m, v in sorted(month_map.items(), reverse=True)[:months]:
        abnormal_rate = round(100.0 * v["abnormal"] / v["screenings"], 1) if v["screenings"] else 0.0
        total_m = v["screenings"]
        closed_m = closed_by_month.get(m, 0)
        completion = round(100.0 * closed_m / max(total_m, 1), 1)
        rows.append(PopulationTrendsRow(month=m, screenings=v["screenings"], abnormal_rate=abnormal_rate,
                                        completion_rate=completion, overdue_count=overdue_count))
    return rows


@router.get("/export")
def population_export(format: str = Query("csv"),
                      current_user: User = Depends(require_perm("population:read")), db: Session = Depends(get_db)):
    """CSV download of aggregated population data. No patient identifiers."""
    overview = population_overview(current_user=current_user, db=db)
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["metric", "value"])
    writer.writerow(["screening_coverage_rate", overview.screening_coverage_rate])
    writer.writerow(["abnormal_rate", overview.abnormal_rate])
    writer.writerow(["follow_up_completion_rate", overview.follow_up_completion_rate])
    writer.writerow(["avg_days_to_consultation", overview.avg_days_to_consultation])
    writer.writerow(["delayed_care_count", overview.delayed_care_count])
    writer.writerow(["referral_completion_rate", overview.referral_completion_rate])
    writer.writerow([])
    writer.writerow(["screening_type", "screenings", "abnormal", "completion_rate"])
    for row in overview.by_type:
        writer.writerow([row.type, row.screenings, row.abnormal, row.completion_rate])
    buf.seek(0)
    filename = f"octoloop_population_{datetime.now(timezone.utc).strftime('%Y%m%d')}.csv"
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
