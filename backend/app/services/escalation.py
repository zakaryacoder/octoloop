"""Escalation engine (V2 multi-level L1/L2/L3).
Idempotent per (case_id, rule_id, level, calendar day). NEVER auto-closes a case.
Creates: escalation_logs row + STAFF notification (dispatched via provider service)
+ ESCALATION case event.
Called lazily inside GET /cases and via APScheduler / external cron hook.
"""
from datetime import datetime, timezone
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.models.case import FollowUpCase
from app.models.escalation import EscalationRule, EscalationLog
from app.models.notification import Notification
from app.models.user import User
from app.services.common import add_case_event, is_case_overdue, user_name
from app.services.notifications import dispatch_notification


def _target_user_for_rule(db: Session, case: FollowUpCase, rule: EscalationRule) -> User | None:
    """L1 -> responsible nurse (case.responsible_id if nurse, else any active nurse).
    L2 -> coordinator. L3 -> authorized supervisor (admin/clinician). Falls back to rule.escalate_to_role."""
    if rule.level == 1 and case.responsible_id:
        resp = db.query(User).filter(User.id == case.responsible_id, User.is_active == True).first()
        if resp and resp.role == "nurse":
            return resp
    target_role = rule.escalate_to_role or ("nurse" if rule.level == 1 else "coordinator" if rule.level == 2 else "admin")
    target = (
        db.query(User)
        .filter(User.is_active == True, User.role == target_role)
        .order_by(User.id.asc())
        .first()
    )
    if target is None:
        target = db.query(User).filter(User.is_active == True, User.role == "coordinator").order_by(User.id.asc()).first()
    return target


def run_escalation_checks(db: Session) -> int:
    """Evaluate all open cases against enabled escalation rules (multi-level).
    Returns # of new escalations created. Idempotent per (case, rule, level, day)."""
    today = datetime.now(timezone.utc).date()
    now = datetime.now(timezone.utc)
    rules = (
        db.query(EscalationRule)
        .filter(EscalationRule.enabled == True)
        .order_by(EscalationRule.level.asc())
        .all()
    )
    if not rules:
        return 0

    open_cases = db.query(FollowUpCase).filter(FollowUpCase.status != "CLOSED").all()
    created = 0
    for case in open_cases:
        if not is_case_overdue(case, today):
            continue
        days_overdue = (today - case.due_date).days
        for rule in rules:
            if days_overdue < rule.trigger_overdue_days:
                continue
            # Idempotency: per (case, rule, level, calendar day).
            existing = (
                db.query(EscalationLog)
                .filter(
                    EscalationLog.case_id == case.id,
                    EscalationLog.rule_id == rule.id,
                    EscalationLog.level == rule.level,
                    func.date(EscalationLog.trigger_date) == today.isoformat(),
                )
                .first()
            )
            if existing:
                continue

            detail = (
                f"L{rule.level} escalation: Case {case.case_ref} overdue by {days_overdue} day(s) "
                f"(due {case.due_date.isoformat()}). Rule '{rule.name}' triggered."
            )
            log = EscalationLog(case_id=case.id, rule_id=rule.id, level=rule.level,
                                trigger_date=now, detail=detail)
            db.add(log)
            db.flush()

            target_user = _target_user_for_rule(db, case, rule)
            if target_user is not None:
                notif = Notification(
                    audience="STAFF",
                    staff_user_id=target_user.id,
                    case_id=case.id,
                    channel=rule.notify_channel or "PORTAL",
                    status="PENDING",
                    subject=f"L{rule.level} Escalation: {case.case_ref} overdue",
                    message=detail,
                )
                db.add(notif)
                db.flush()
                dispatch_notification(db, notif)  # sets SENT/QUEUED/FAILED honestly

            add_case_event(
                db, case, event_type="ESCALATION", note=detail,
                actor_id=target_user.id if target_user else None,
            )
            created += 1

    if created:
        db.commit()
    return created
