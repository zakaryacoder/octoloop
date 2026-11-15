# OCTOLOOP API Reference (v1)

Base URL: `http://localhost:8000/api/v1`
Auth: `Authorization: Bearer <jwt>` (JWT payload: `sub=user_id`, `role`, `username`)
Errors: `{ "detail": "..." }` with proper HTTP status. All timestamps ISO-8601 UTC. All IDs integer.
Auto-generated interactive docs: `http://localhost:8000/docs` (Swagger UI) and `/redoc`.

## Database note (portable demo)
The demo runs on **SQLite** by default (`DATABASE_URL=sqlite:///./database/octoloop.db`, file lands at `OCTOLOOP/database/octoloop.db`) so no database server is required. All models are DB-agnostic; set `DATABASE_URL=postgresql+psycopg2://user:pass@host/db` for production. Alembic migrations live in `database/alembic/`; `scripts/init_db.py` does `create_all` + seed and works without Alembic.

## Demo credentials (seeded)

| username | password | role |
|---|---|---|
| admin | Admin@12345 | admin |
| dr.smith | Clinician@123 | clinician |
| nurse.jones | Nurse@12345 | nurse |
| coordinator.lee | Coord@12345 | coordinator |
| viewer.demo | Viewer@12345 | viewer |

## Auth

### POST /auth/login
Body: `{"username": "admin", "password": "Admin@12345"}` → `{access_token, token_type:"bearer", user:{id,username,full_name,role}}`. 401 on bad creds. After 5 failed attempts per username, account is locked for 5 minutes (429).
```bash
curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"Admin@12345"}'
```

### POST /auth/logout → 200 `{"ok":true}` (writes audit log). Requires Bearer token.
### GET /auth/me → current user object.

## Dashboard
### GET /dashboard/summary
Returns KPIs + breakdowns: `total_patients, total_screenings, abnormal_results, open_follow_up_cases, overdue_cases, completed_follow_ups, pending_referrals, upcoming_appointments, follow_up_completion_rate, screening_to_care_conversion_rate, screening_volume_by_month[], cases_by_status[], overdue_by_responsible[], recent_activity[]`.
```bash
TOKEN=<jwt>; curl -s http://localhost:8000/api/v1/dashboard/summary -H "Authorization: Bearer $TOKEN"
```

## Patients
- `GET /patients?search=&page=&page_size=` → `{items:[...], total, page, page_size}`
- `POST /patients` → created patient (422 on validation error)
- `GET /patients/{id}` → patient + `screenings`, `follow_up_cases`, `referrals`, `appointments` arrays
- `PUT /patients/{id}` → updated patient

## Screenings
- `GET /screenings?patient_id=&type=&classification=&page=&page_size=` → paginated
- `POST /screenings` body `{patient_id, type, screening_date, facility, performed_by?}` → screening (no result yet)
- `POST /screenings/{id}/result` body `{result_classification, result_summary, recorded_by?}` → `{screening, created_case?}`. If classification is `ABNORMAL` or `BORDERLINE` and no open case exists, auto-creates a follow-up case (status `NEW_RESULT`, priority derived).
- `POST /screenings/{id}/assign` body `{clinician_id}` → screening

## Follow-up Cases (core)
Case ref format: `FU-YYYY-NNNN` sequential. Status workflow (ordered):
`NEW_RESULT → AWAITING_REVIEW → PATIENT_NOTIFICATION_PENDING → PATIENT_NOTIFIED → AWAITING_CONFIRMATION → REFERRAL_PENDING → APPOINTMENT_PENDING → CONSULTATION_COMPLETED → TREATMENT_OR_SURVEILLANCE → CLOSED`.
- `GET /cases?status=&priority=&responsible_id=&overdue_only=&patient_id=&search=&page=` → paginated (runs escalation checks lazily)
- `GET /cases/overdue` → list of overdue cases
- `POST /cases` body `{patient_id, screening_id?, priority, responsible_id?, due_date?, next_action}` → case
- `GET /cases/{id}` → case + `events[]` + `referrals[]` + `appointments[]` + `patient` + `screening`
- `PUT /cases/{id}` body `{priority?, responsible_id?, due_date?, next_action?}` → case
- `POST /cases/{id}/advance` body `{to_status, note?}` → validates transition order; skipping statuses requires admin role or a non-empty note. Writes `STATUS_CHANGE` event.
- `POST /cases/{id}/events` body `{event_type, note, contact_outcome?}` → event
- `POST /cases/{id}/close` body `{closure_reason, note}` → status `CLOSED`, writes `CASE_CLOSED` event. **Only an authenticated human user may close a case; no AI/automation endpoint closes cases.**

## Referrals
- `GET /referrals?status=&page=` → paginated
- `POST /referrals` body `{patient_id, case_id?, to_department, reason, notes?}` → status `DRAFT`
- `POST /referrals/{id}/send` → `SENT`
- `POST /referrals/{id}/accept` body `{notes?}` → `ACCEPTED`; linked case advances to `APPOINTMENT_PENDING`
- `POST /referrals/{id}/reject` body `{reason}` → `REJECTED`
- `POST /referrals/{id}/complete` body `{outcome}` → `COMPLETED`

## Appointments
- `GET /appointments?date_from=&date_to=&status=&patient_id=&case_id=&page=` → paginated
- `POST /appointments` body `{patient_id, case_id?, referral_id?, department, clinician_id?, scheduled_at, duration_min?, notes?}` → `SCHEDULED`; writes `APPOINTMENT_SCHEDULED` event on linked case
- `PUT /appointments/{id}` (reschedule) body `{scheduled_at, notes?}` → `RESCHEDULED`
- `POST /appointments/{id}/cancel` body `{reason}` → `CANCELLED`
- `POST /appointments/{id}/complete` body `{attended: bool, notes?}` → `COMPLETED` or `NO_SHOW`; if linked case and attended, advances to `CONSULTATION_COMPLETED`

## Notifications
- `GET /notifications?audience=&status=&case_id=&page=` → paginated
- `POST /notifications/send` body `{audience, patient_id?, staff_user_id?, case_id?, channel, subject, message}` → creates notification (status `SENT`), writes `NOTIFICATION_SENT` event, updates case `last_contact_at`
- `GET /notifications/staff/unread` → staff notifications for current user
- `POST /notifications/{id}/acknowledge` → `ACKNOWLEDGED`

## Analytics (all values labeled illustrative in UI)
- `GET /analytics/overview` → `{screening_volume, abnormal_rate, follow_up_completion_rate, avg_days_screening_to_notification, avg_days_screening_to_consultation, overdue_rate, referral_completion_rate, lost_to_follow_up_count}`
- `GET /analytics/screening-volume?months=12` → `[{month, total, abnormal, actionable}]`
- `GET /analytics/timeliness` → `[{screening_type, avg_days_to_notification, avg_days_to_consultation, median_days_to_closure}]`
- `GET /analytics/lost-to-followup` → `[{reason, count}]`

## AI-assisted (deterministic, offline, rule-based — no external API, no LLM)
- `POST /ai/summarize-case` body `{case_id}` → `{summary, overdue, missing_steps[], suggested_next_actions[], risk_flags[]}`. Summary always includes the fixed operational-only disclaimer; clinical decisions require authorized human oversight.
- `GET /ai/operational-insights` → `{insights[], top_overdue_cases:[{case_ref, patient_name, days_overdue}], bottlenecks[]}`

## Admin / Settings (admin role required for mutations)
- `GET /users`, `POST /users`, `PUT /users/{id}` — admin only
- `GET /roles` → `[{name, permissions: [string]}]`
- `GET /audit-logs?user_id=&page=` → paginated audit log
- `GET /escalation-rules`, `POST /escalation-rules`, `PUT /escalation-rules/{id}` — admin
- `GET /settings`, `PUT /settings` (admin) → key/value system settings

## Escalation engine
Runs lazily on each `GET /cases` and `GET /cases/overdue` (also callable via `app.services.escalation.run_escalation_checks(db)`). For each open case past `due_date`, if an enabled rule's `trigger_overdue_days` is met, it creates (idempotently per case+rule+day) an `escalation_logs` row + a `STAFF` notification to the target role + an `ESCALATION` case event.

## Run commands
```bash
# from OCTOLOOP/
pip install -r backend/requirements.txt
python scripts/init_db.py            # create tables + seed demo data
cd backend && uvicorn app.main:app --port 8000
# or on Windows: scripts\start_backend.bat
# reset demo: scripts\reset_demo.bat (deletes DB, recreates, reseeds)
pytest tests/ -q                     # 38 tests
```
