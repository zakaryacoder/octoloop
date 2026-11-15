"""Deterministic demo-data seeder. Idempotent: skips full seed if admin user already exists,
but ALWAYS ensures V2 permissions / role grants / patient portal user are present (upgrade-safe).
"""
import json
import random
from datetime import date, datetime, timedelta, timezone
from sqlalchemy.orm import Session
from app.core.security import get_password_hash
from app.models.user import User, Role, Permission, NotificationPreference
from app.models.patient import Patient, PatientInstruction
from app.models.screening import Screening, ScreeningResult
from app.models.case import FollowUpCase, CaseEvent, CASE_STATUS_ORDER
from app.models.referral import Referral
from app.models.appointment import Appointment
from app.models.notification import Notification
from app.models.escalation import EscalationRule
from app.models.audit import AuditLog, SystemSetting
from app.services.common import generate_case_ref, derive_priority, add_case_event

TODAY = date(2026, 11, 13)

DEMO_USERS = [
    ("admin", "Admin@12345", "admin", "System Administrator", "admin@octoloop.local"),
    ("dr.smith", "Clinician@123", "clinician", "Dr. Alice Smith", "smith@octoloop.local"),
    ("nurse.jones", "Nurse@12345", "nurse", "Nurse Bob Jones", "jones@octoloop.local"),
    ("coordinator.lee", "Coord@12345", "coordinator", "Carol Lee", "lee@octoloop.local"),
    ("viewer.demo", "Viewer@12345", "viewer", "Demo Viewer", "viewer@octoloop.local"),
]

# V2 patient portal demo user — linked to a seeded patient.
PATIENT_PORTAL_USER = ("patient.ross", "Patient@12345", "patient", "Rachel Ross", "ross.patient@example.com")

# V2 permission strings (exact, per V2_CONTRACT §2).
ALL_PERMISSIONS = [
    "patients:read", "patients:create", "patients:update",
    "screenings:read", "screenings:create", "screenings:record", "screenings:assign",
    "cases:read", "cases:create", "cases:update", "cases:assign", "cases:escalate", "cases:close",
    "referrals:read", "referrals:create", "referrals:manage",
    "appointments:read", "appointments:create", "appointments:manage",
    "notifications:read", "notifications:send",
    "users:manage", "roles:read", "audit:read", "settings:manage",
    "escalation_rules:manage", "population:read", "portal:self",
]

_READ_STAFF = ["patients:read", "screenings:read", "cases:read", "referrals:read",
               "appointments:read", "notifications:read", "roles:read", "audit:read", "population:read"]

ROLE_PERMISSIONS = {
    "admin": list(ALL_PERMISSIONS),
    "clinician": [p for p in ALL_PERMISSIONS if p not in
                  ("users:manage", "settings:manage", "escalation_rules:manage", "portal:self")],
    "coordinator": _READ_STAFF + [
        "patients:create", "patients:update",
        "screenings:create", "screenings:assign",  # no screenings:record
        "cases:create", "cases:update", "cases:assign", "cases:escalate", "cases:close",
        "referrals:create", "referrals:manage",
        "appointments:create", "appointments:manage",
        "notifications:send",
    ],
    "nurse": _READ_STAFF + [
        "patients:create", "patients:update",
        "screenings:create", "screenings:assign",  # no screenings:record
        "cases:create", "cases:update", "cases:assign",  # no cases:close, no cases:escalate
        "notifications:send",
    ],
    "viewer": ["patients:read", "screenings:read", "cases:read", "referrals:read",
               "appointments:read", "notifications:read", "roles:read", "audit:read", "population:read"],
    "patient": ["portal:self"],
}

FIRST_NAMES = ["Olivia", "Liam", "Emma", "Noah", "Ava", "Ethan", "Sophia", "Mason", "Isabella", "Lucas",
               "Mia", "Logan", "Charlotte", "Elijah", "Amelia", "James", "Harper", "Benjamin", "Evelyn", "Henry",
               "Abigail", "Alexander", "Emily", "Sebastian", "Elizabeth", "Jack", "Sofia", "Owen", "Avery", "Samuel"]
LAST_NAMES = ["Harris", "Clark", "Lewis", "Walker", "Hall", "Young", "King", "Wright", "Scott", "Green",
              "Adams", "Baker", "Nelson", "Carter", "Mitchell", "Perez", "Roberts", "Turner", "Phillips", "Campbell",
              "Parker", "Evans", "Edwards", "Collins", "Stewart", "Sanchez", "Morris", "Rogers", "Reed", "Cook"]
SCREENING_TYPES = ["BREAST", "CERVICAL", "COLORECTAL", "DIABETES", "HYPERTENSION", "OTHER"]
CLASSIFICATIONS = ["NORMAL", "BORDERLINE", "ABNORMAL", "NORMAL", "NORMAL", "BORDERLINE", "ABNORMAL", "INADEQUATE", "NORMAL", "BORDERLINE"]
FACILITIES = ["Downtown Health Center", "Northside Clinic", "Riverside Medical", "Eastgate Screening Hub", "University Hospital"]


def ensure_v2_permissions_and_roles(db: Session) -> dict:
    """Idempotently ensure all V2 permissions + roles + role grants exist. Safe on existing DBs."""
    existing_perms = {p.name: p for p in db.query(Permission).all()}
    for pname in ALL_PERMISSIONS:
        if pname not in existing_perms:
            p = Permission(name=pname, description=pname)
            db.add(p)
            existing_perms[pname] = p
    db.flush()
    existing_roles = {r.name: r for r in db.query(Role).all()}
    for rname, plist in ROLE_PERMISSIONS.items():
        role = existing_roles.get(rname)
        if role is None:
            role = Role(name=rname, description=f"{rname.title()} role")
            db.add(role)
            db.flush()
            existing_roles[rname] = role
        wanted = {existing_perms[p] for p in plist}
        current = set(role.permissions)
        for perm in wanted - current:
            role.permissions.append(perm)
    db.flush()
    return {"permissions": len(ALL_PERMISSIONS), "roles": len(ROLE_PERMISSIONS)}


def ensure_patient_portal_user(db: Session) -> dict:
    """Idempotently ensure patient.ross exists and is linked to a patient record."""
    username, password, role, full_name, email = PATIENT_PORTAL_USER
    u = db.query(User).filter(User.username == username).first()
    patient = db.query(Patient).order_by(Patient.id.asc()).first()
    if patient is None:
        # No patients at all (fresh DB before full seed) — create a dedicated patient.
        patient = Patient(
            mrn="OCT-PORTAL-001", first_name="Rachel", last_name="Ross",
            date_of_birth=date(1985, 4, 12), gender="F", phone="+1-555-0199",
            email=email, address="123 Portal Ave, Springfield",
            medical_history_summary="Hypertension", allergies="NKDA",
        )
        db.add(patient)
        db.flush()
    if u is None:
        u = User(
            username=username, hashed_password=get_password_hash(password),
            full_name=full_name, email=email, role=role, is_active=True,
            patient_id=patient.id,
        )
        db.add(u)
        db.flush()
        # Default notification preferences.
        db.add(NotificationPreference(user_id=u.id, channel_enabled=json.dumps(
            {"SMS": True, "EMAIL": True, "PORTAL": True, "PHONE": True, "LETTER": False})))
    else:
        if u.patient_id is None:
            u.patient_id = patient.id
        if u.role != role:
            u.role = role
    db.flush()
    return {"patient_user": username, "linked_patient_id": patient.id}


def seed_demo_data(db: Session) -> dict:
    ensure_v2_permissions_and_roles(db)

    if db.query(User).filter(User.username == "admin").first():
        # Already seeded: ensure V2 artifacts exist, then skip full seed.
        ensure_patient_portal_user(db)
        # Ensure escalation rules have a level column value (V2 multi-level).
        for rule in db.query(EscalationRule).all():
            if not rule.level:
                rule.level = 1
        db.commit()
        return {"skipped": True, "reason": "already seeded; V2 permissions/roles/patient-user ensured"}

    rng = random.Random(42)
    role_objs = {r.name: r for r in db.query(Role).all()}

    # ---- Users ----
    users = {}
    for username, password, role, full_name, email in DEMO_USERS:
        u = User(
            username=username,
            hashed_password=get_password_hash(password),
            full_name=full_name,
            email=email,
            role=role,
            is_active=True,
            last_login_at=datetime.now(timezone.utc) - timedelta(hours=rng.randint(1, 72)),
        )
        u.roles = [role_objs[role]]
        db.add(u)
        users[username] = u
    db.flush()
    clinician_ids = [users["dr.smith"].id, users["nurse.jones"].id]

    # ---- Escalation rules (V2 multi-level L1/L2/L3) ----
    db.add_all([
        EscalationRule(name="L1: overdue 3 days -> responsible nurse", enabled=True, level=1,
                       trigger_overdue_days=3, escalate_to_role="nurse", notify_channel="PORTAL"),
        EscalationRule(name="L2: overdue 7 days -> coordinator", enabled=True, level=2,
                       trigger_overdue_days=7, escalate_to_role="coordinator", notify_channel="EMAIL"),
        EscalationRule(name="L3: overdue 14 days -> admin supervisor", enabled=True, level=3,
                       trigger_overdue_days=14, escalate_to_role="admin", notify_channel="SMS"),
    ])

    # ---- Settings ----
    db.add_all([
        SystemSetting(key="org_name", value="OCTOLOOP Demo Clinic"),
        SystemSetting(key="default_follow_up_days", value="14"),
        SystemSetting(key="escalation_enabled", value="true"),
        SystemSetting(key="facility_phone", value="+1-555-0100"),
        SystemSetting(key="facility_email", value="clinic@octoloop.local"),
        SystemSetting(key="facility_hours", value="Mon-Fri 08:00-17:00"),
    ])

    # ---- Patients (30) ----
    patients = []
    for i in range(30):
        dob = date(1955, 1, 1) + timedelta(days=rng.randint(0, 365 * 50))
        region = rng.choice(["Downtown", "Northside", "Riverside", "Eastgate", "Westfield"])
        p = Patient(
            mrn=f"OCT-{1000 + i}",
            first_name=FIRST_NAMES[i],
            last_name=LAST_NAMES[i],
            date_of_birth=dob,
            gender=rng.choice(["F", "M", "Other"]),
            phone=f"+1-555-01{i:02d}",
            email=f"{FIRST_NAMES[i].lower()}.{LAST_NAMES[i].lower()}@example.com",
            address=f"{rng.randint(1, 999)} {region} District, Springfield",
            primary_clinician_id=rng.choice(clinician_ids),
            medical_history_summary=rng.choice(["Hypertension", "Type 2 diabetes", "None noted", "Family history of cancer", "Asthma"]),
            allergies=rng.choice(["None", "Penicillin", "NKDA", "Sulfa"]),
        )
        db.add(p)
        patients.append(p)
    db.flush()

    # Link patient portal user to the first patient.
    portal_patient = patients[0]
    username, password, role, full_name, email = PATIENT_PORTAL_USER
    portal_user = User(
        username=username, hashed_password=get_password_hash(password),
        full_name=full_name, email=email, role=role, is_active=True,
        patient_id=portal_patient.id,
    )
    portal_user.roles = [role_objs["patient"]]
    db.add(portal_user)
    db.flush()
    db.add(NotificationPreference(user_id=portal_user.id, channel_enabled=json.dumps(
        {"SMS": True, "EMAIL": True, "PORTAL": True, "PHONE": True, "LETTER": False})))
    # A staff-entered instruction visible in the portal.
    db.add(PatientInstruction(patient_id=portal_patient.id, entered_by=users["dr.smith"].id,
                              instruction="Please fast for 8 hours before your upcoming blood draw. Bring your medication list."))
    db.flush()

    # ---- Screenings (50) with results ----
    screenings = []
    actionable_screenings = []
    for i in range(50):
        sdate = TODAY - timedelta(days=rng.randint(5, 365))
        stype = SCREENING_TYPES[i % len(SCREENING_TYPES)]
        classification = CLASSIFICATIONS[i % len(CLASSIFICATIONS)]
        s = Screening(
            patient_id=patients[i % 30].id,
            type=stype,
            screening_date=sdate,
            facility=rng.choice(FACILITIES),
            performed_by=rng.choice(["Dr. Alice Smith", "Nurse Bob Jones", "Lab Tech"]),
            result_classification=classification,
            result_summary=f"{stype} screening result: {classification.lower()}.",
            assigned_clinician_id=rng.choice(clinician_ids),
        )
        db.add(s)
        db.flush()
        sr = ScreeningResult(
            screening_id=s.id,
            result_classification=classification,
            result_summary=s.result_summary,
            recorded_by=users["dr.smith"].id,
            recorded_at=datetime.combine(sdate, datetime.min.time(), tzinfo=timezone.utc) + timedelta(hours=9),
        )
        db.add(sr)
        screenings.append(s)
        if classification in ("ABNORMAL", "BORDERLINE"):
            actionable_screenings.append(s)

    # ---- Follow-up cases (20) — mix all 10 statuses, >=4 overdue, >=5 closed ----
    cases = []
    status_distribution = (
        ["NEW_RESULT"] * 2 + ["AWAITING_REVIEW"] * 2 + ["PATIENT_NOTIFICATION_PENDING"] * 2
        + ["PATIENT_NOTIFIED"] * 2 + ["AWAITING_CONFIRMATION"] * 2 + ["REFERRAL_PENDING"] * 2
        + ["APPOINTMENT_PENDING"] * 2 + ["CONSULTATION_COMPLETED"] * 1 + ["TREATMENT_OR_SURVEILLANCE"] * 1
        + ["CLOSED"] * 5
    )
    rng.shuffle(status_distribution)
    overdue_marks = set(rng.sample([i for i, s in enumerate(status_distribution) if s != "CLOSED"], 4))
    for i, status in enumerate(status_distribution):
        scr = actionable_screenings[i % len(actionable_screenings)]
        year = (TODAY - timedelta(days=rng.randint(0, 300))).year
        case_ref = generate_case_ref(db, year)
        if i in overdue_marks:
            due_date = TODAY - timedelta(days=rng.randint(2, 20))
        elif status == "CLOSED":
            due_date = TODAY - timedelta(days=rng.randint(30, 90))
        else:
            due_date = TODAY + timedelta(days=rng.randint(1, 30))
        c = FollowUpCase(
            case_ref=case_ref,
            patient_id=scr.patient_id,
            screening_id=scr.id,
            screening_type=scr.type,
            result_classification=scr.result_classification,
            priority=derive_priority(scr.result_classification),
            responsible_id=rng.choice([users["dr.smith"].id, users["coordinator.lee"].id, users["nurse.jones"].id]),
            status=status,
            due_date=due_date,
            last_contact_at=datetime.now(timezone.utc) - timedelta(days=rng.randint(0, 20)) if status != "NEW_RESULT" else None,
            next_action=rng.choice(["Review result", "Contact patient", "Schedule referral", "Book appointment", "Await consultation"]),
            closure_reason=rng.choice(["RESOLVED", "LOST_TO_FOLLOWUP", "TRANSFERRED", "NO_ACTION_REQUIRED"]) if status == "CLOSED" else None,
            closed_at=datetime.now(timezone.utc) - timedelta(days=rng.randint(5, 60)) if status == "CLOSED" else None,
        )
        db.add(c)
        db.flush()
        cases.append(c)
    db.flush()

    for c in cases:
        add_case_event(db, c, event_type="CASE_CREATED", note=f"Case {c.case_ref} opened from screening #{c.screening_id}.",
                       actor_id=users["dr.smith"].id)
        try:
            cur_idx = CASE_STATUS_ORDER.index(c.status)
        except ValueError:
            cur_idx = 0
        for s in CASE_STATUS_ORDER[1:cur_idx + 1]:
            if s == "CLOSED":
                add_case_event(db, c, event_type="CASE_CLOSED", note=f"Closed: {c.closure_reason}", actor_id=users["dr.smith"].id)
            else:
                add_case_event(db, c, event_type="STATUS_CHANGE", note=f"Advanced to {s}.", actor_id=users["coordinator.lee"].id)
        if rng.random() < 0.5:
            add_case_event(db, c, event_type="NOTE", note="Routine check-in note.", actor_id=users["nurse.jones"].id)

    # ---- Referrals (10) ----
    referrals = []
    ref_statuses = ["DRAFT", "SENT", "ACCEPTED", "REJECTED", "COMPLETED", "SENT", "ACCEPTED", "CANCELLED", "SENT", "COMPLETED"]
    ref_cases = [c for c in cases if c.status not in ("CLOSED", "NEW_RESULT", "AWAITING_REVIEW")][:10]
    for i in range(10):
        c = ref_cases[i % len(ref_cases)] if ref_cases else cases[i]
        st = ref_statuses[i]
        r = Referral(
            patient_id=c.patient_id,
            case_id=c.id,
            from_department="Primary Care",
            to_department=rng.choice(["Oncology", "Gynecology", "Gastroenterology", "Endocrinology", "Cardiology"]),
            reason=f"Follow-up for {c.result_classification.lower()} {c.screening_type.lower()} screening.",
            status=st,
            sent_at=datetime.now(timezone.utc) - timedelta(days=rng.randint(1, 20)) if st != "DRAFT" else None,
            responded_at=datetime.now(timezone.utc) - timedelta(days=rng.randint(1, 10)) if st in ("ACCEPTED", "REJECTED") else None,
            completed_at=datetime.now(timezone.utc) - timedelta(days=rng.randint(1, 5)) if st == "COMPLETED" else None,
            notes="Demo referral.",
        )
        db.add(r)
        referrals.append(r)
        add_case_event(db, c, event_type="REFERRAL_CREATED", note=f"Referral to {r.to_department} created.", actor_id=users["coordinator.lee"].id)

    # ---- Appointments (15) ----
    appt_statuses = ["SCHEDULED", "CONFIRMED", "CHECKED_IN", "COMPLETED", "NO_SHOW", "CANCELLED",
                     "RESCHEDULED", "SCHEDULED", "CONFIRMED", "COMPLETED", "SCHEDULED", "COMPLETED",
                     "CONFIRMED", "SCHEDULED", "COMPLETED"]
    appt_cases = [c for c in cases if c.status not in ("CLOSED", "NEW_RESULT")][:15]
    for i in range(15):
        c = appt_cases[i % len(appt_cases)] if appt_cases else cases[i % len(cases)]
        st = appt_statuses[i]
        sched = datetime.now(timezone.utc) + timedelta(days=rng.randint(-10, 14), hours=rng.randint(8, 16))
        a = Appointment(
            patient_id=c.patient_id,
            case_id=c.id,
            referral_id=referrals[i % len(referrals)].id if i < len(referrals) else None,
            department=rng.choice(["Oncology", "Gynecology", "General Medicine"]),
            clinician_id=users["dr.smith"].id,
            scheduled_at=sched,
            duration_min=rng.choice([15, 30, 45, 60]),
            status=st,
            notes="Demo appointment.",
            attended_at=sched if st == "COMPLETED" else None,
        )
        db.add(a)
        if st in ("SCHEDULED", "CONFIRMED", "CHECKED_IN"):
            add_case_event(db, c, event_type="APPOINTMENT_SCHEDULED", note=f"Appointment scheduled at {a.department}.",
                           actor_id=users["coordinator.lee"].id)
        if st == "COMPLETED":
            add_case_event(db, c, event_type="APPOINTMENT_COMPLETED", note="Consultation completed.",
                           actor_id=users["dr.smith"].id)

    # ---- Notifications (for cases) — V2: QUEUED when no provider (seed sets SENT for historical demo data) ----
    for c in cases[:12]:
        db.add(Notification(
            audience="PATIENT", patient_id=c.patient_id, case_id=c.id,
            channel=rng.choice(["SMS", "EMAIL", "PORTAL"]), status="SENT",
            subject="Follow-up required", message=f"Please contact us regarding your screening result. Case {c.case_ref}.",
            sent_at=datetime.now(timezone.utc) - timedelta(days=rng.randint(1, 15)),
        ))
    for c in cases[:6]:
        db.add(Notification(
            audience="STAFF", staff_user_id=users["coordinator.lee"].id, case_id=c.id,
            channel="PORTAL", status="SENT",
            subject="Case assignment", message=f"You are responsible for case {c.case_ref}.",
            sent_at=datetime.now(timezone.utc) - timedelta(days=rng.randint(1, 10)),
        ))

    # ---- Audit events ----
    for username in ["admin", "dr.smith", "coordinator.lee"]:
        db.add(AuditLog(
            user_id=users[username].id, username=username, action="LOGIN",
            entity_type="auth", details="Demo seed login event.",
        ))
    db.add(AuditLog(action="SEED", entity_type="system", details="Demo data seeded."))

    db.commit()
    return {
        "users": len(DEMO_USERS) + 1,  # + patient portal user
        "patients": 30,
        "screenings": 50,
        "screening_results": 50,
        "follow_up_cases": 20,
        "referrals": 10,
        "appointments": 15,
        "notifications": 18,
        "audit_logs": 4,
        "escalation_rules": 3,
        "permissions": len(ALL_PERMISSIONS),
        "roles": len(ROLE_PERMISSIONS),
        "overdue_cases": 4,
        "closed_cases": 5,
        "patient_portal_user": PATIENT_PORTAL_USER[0],
    }
