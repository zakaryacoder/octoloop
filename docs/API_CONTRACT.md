# OCTOLOOP — Frozen API Contract (v1)

Both backend and frontend MUST implement against this contract exactly. Base path: `/api/v1`.
Auth: `Authorization: Bearer <jwt>`. JWT payload: `sub=user_id, role, username`.
Errors: `{ "detail": "..." }` with proper HTTP status. All timestamps ISO-8601 UTC. All IDs integer.

## Enums (string values, exact)

- **Role**: `admin` | `clinician` | `nurse` | `coordinator` | `viewer`
- **ScreeningType**: `BREAST` | `CERVICAL` | `COLORECTAL` | `DIABETES` | `HYPERTENSION` | `OTHER`
- **ResultClassification**: `NORMAL` | `BORDERLINE` | `ABNORMAL` | `INADEQUATE`
  - Actionable (auto-creates follow-up case): `ABNORMAL` | `BORDERLINE`
- **CaseStatus** (ordered workflow):
  `NEW_RESULT` → `AWAITING_REVIEW` → `PATIENT_NOTIFICATION_PENDING` → `PATIENT_NOTIFIED` →
  `AWAITING_CONFIRMATION` → `REFERRAL_PENDING` → `APPOINTMENT_PENDING` →
  `CONSULTATION_COMPLETED` → `TREATMENT_OR_SURVEILLANCE` → `CLOSED`
- **Priority**: `LOW` | `MEDIUM` | `HIGH` | `URGENT`
- **ClosureReason**: `RESOLVED` | `LOST_TO_FOLLOWUP` | `TRANSFERRED` | `NO_ACTION_REQUIRED` | `DECEASED`
- **ReferralStatus**: `DRAFT` | `SENT` | `ACCEPTED` | `REJECTED` | `COMPLETED` | `CANCELLED`
- **AppointmentStatus**: `SCHEDULED` | `CONFIRMED` | `CHECKED_IN` | `COMPLETED` | `NO_SHOW` | `CANCELLED` | `RESCHEDULED`
- **NotificationChannel**: `SMS` | `EMAIL` | `PHONE` | `PORTAL` | `LETTER`
- **NotificationStatus**: `PENDING` | `SENT` | `DELIVERED` | `FAILED` | `ACKNOWLEDGED`
- **NotificationAudience**: `PATIENT` | `STAFF`
- **CaseEventType**: `STATUS_CHANGE` | `NOTE` | `PATIENT_CONTACT` | `NOTIFICATION_SENT` | `ESCALATION` | `REFERRAL_CREATED` | `APPOINTMENT_SCHEDULED` | `APPOINTMENT_COMPLETED` | `CASE_CREATED` | `CASE_CLOSED` | `ASSIGNMENT_CHANGE` | `RESULT_RECORDED`

## Auth

- `POST /auth/login` body `{username, password}` → `{access_token, token_type:"bearer", user:{id,username,full_name,role}}`. 401 on bad creds. Lockout after 5 failed attempts (5 min).
- `POST /auth/logout` → 200 (writes audit log).
- `GET /auth/me` → current user object.

## Dashboard

- `GET /dashboard/summary` →
  ```
  { total_patients, total_screenings, abnormal_results, open_follow_up_cases,
    overdue_cases, completed_follow_ups, pending_referrals, upcoming_appointments,
    follow_up_completion_rate (0-100), screening_to_care_conversion_rate (0-100),
    screening_volume_by_month: [{month:"2026-09", total, abnormal}],
    cases_by_status: [{status, count}],
    overdue_by_responsible: [{responsible, count}],
    recent_activity: [{id, timestamp, actor, action, patient_name, case_id?}] }
  ```

## Patients

- `GET /patients?search=&page=&page_size=` → `{items:[...], total, page, page_size}`. Patient: `{id, mrn, first_name, last_name, date_of_birth, gender, phone, email, address, primary_clinician_id, medical_history_summary, allergies, created_at, updated_at}`.
- `POST /patients` → created patient (422 on validation).
- `GET /patients/{id}` → patient + `screenings`, `follow_up_cases`, `referrals`, `appointments` arrays (lightweight).
- `PUT /patients/{id}` → updated patient.

## Screenings

- `GET /screenings?patient_id=&type=&classification=&page=` → paginated. Screening: `{id, patient_id, patient_name, type, screening_date, facility, performed_by, result_classification, result_summary, actionable, assigned_clinician_id, created_at}`.
- `POST /screenings` body `{patient_id, type, screening_date, facility, performed_by?}` → screening (no result yet).
- `POST /screenings/{id}/result` body `{result_classification, result_summary, recorded_by}` → screening; if actionable and no open case exists, auto-creates a `follow_up_case` (status NEW_RESULT, priority derived) and returns it in `{screening, created_case?}`.
- `POST /screenings/{id}/assign` body `{clinician_id}` → screening.

## Follow-up Cases (CORE)

- `GET /cases?status=&priority=&responsible_id=&overdue_only=&patient_id=&search=&page=` → paginated. Case: `{id, case_ref (string e.g. "FU-2026-0001"), patient_id, patient_name, screening_id, screening_type, result_classification, priority, responsible_id, responsible_name, status, due_date, last_contact_at, next_action, created_at, updated_at, overdue: bool}`.
- `POST /cases` (manual) body `{patient_id, screening_id?, priority, responsible_id, due_date, next_action}` → case.
- `GET /cases/{id}` → case + `events[]` + `referrals[]` + `appointments[]` + `patient` + `screening`.
- `PUT /cases/{id}` body `{priority?, responsible_id?, due_date?, next_action?}` → case.
- `POST /cases/{id}/advance` body `{to_status, note?}` → validates transition order (skip allowed only with admin role or with note), writes STATUS_CHANGE event, returns case.
- `POST /cases/{id}/events` body `{event_type, note, contact_outcome?}` → event.
- `POST /cases/{id}/close` body `{closure_reason, note}` → status CLOSED, writes CASE_CLOSED event. AI/automation may NOT call this (enforced: only human user endpoints).
- `GET /cases/overdue` → list of overdue cases (same shape).

## Referrals

- `GET /referrals?status=&page=` → paginated. Referral: `{id, patient_id, patient_name, case_id, from_department, to_department, reason, status, sent_at, responded_at, completed_at, notes}`.
- `POST /referrals` body `{patient_id, case_id?, to_department, reason, notes?}` → referral (status DRAFT).
- `POST /referrals/{id}/send` → status SENT.
- `POST /referrals/{id}/accept` body `{notes?}` → ACCEPTED; if linked case, advances it toward APPOINTMENT_PENDING (writes event).
- `POST /referrals/{id}/reject` body `{reason}` → REJECTED.
- `POST /referrals/{id}/complete` body `{outcome}` → COMPLETED.

## Appointments

- `GET /appointments?date_from=&date_to=&status=&patient_id=&case_id=&page=` → paginated. Appointment: `{id, patient_id, patient_name, case_id?, referral_id?, department, clinician_id, scheduled_at, duration_min, status, notes, attended_at}`.
- `POST /appointments` body `{patient_id, case_id?, referral_id?, department, clinician_id?, scheduled_at, duration_min?, notes?}` → SCHEDULED; writes APPOINTMENT_SCHEDULED event on linked case.
- `PUT /appointments/{id}` (reschedule) body `{scheduled_at, notes?}` → RESCHEDULED history note.
- `POST /appointments/{id}/cancel` body `{reason}` → CANCELLED.
- `POST /appointments/{id}/complete` body `{attended: bool, notes?}` → COMPLETED or NO_SHOW; if linked case and attended, advances to CONSULTATION_COMPLETED (writes event).

## Notifications

- `GET /notifications?audience=&status=&case_id=&page=` → paginated. Notification: `{id, audience, patient_id?, staff_user_id?, case_id?, channel, status, subject, message, sent_at, acknowledged_at}`.
- `POST /notifications/send` body `{audience, patient_id?, staff_user_id?, case_id?, channel, subject, message}` → creates notification (status SENT), writes NOTIFICATION_SENT event on linked case, updates case.last_contact_at.
- `GET /notifications/staff/unread` → staff notifications for current user.
- `POST /notifications/{id}/acknowledge` → ACKNOWLEDGED.

## Analytics (all values labeled illustrative in UI)

- `GET /analytics/overview` → `{screening_volume, abnormal_rate, follow_up_completion_rate, avg_days_screening_to_notification, avg_days_screening_to_consultation, overdue_rate, referral_completion_rate, lost_to_follow_up_count}`.
- `GET /analytics/screening-volume?months=12` → `[{month, total, abnormal, actionable}]`.
- `GET /analytics/timeliness` → `[{screening_type, avg_days_to_notification, avg_days_to_consultation, median_days_to_closure}]`.
- `GET /analytics/lost-to-followup` → `[{reason, count}]`.

## AI-assisted (rule-based operational intelligence — deterministic, offline)

- `POST /ai/summarize-case` body `{case_id}` → `{summary: string, overdue: bool, missing_steps: [string], suggested_next_actions: [string], risk_flags: [string]}`. NEVER clinical advice; always includes disclaimer string.
- `GET /ai/operational-insights` → `{insights: [string], top_overdue_cases: [{case_ref, patient_name, days_overdue}], bottlenecks: [string]}`.

## Admin / Settings

- `GET /users`, `POST /users`, `PUT /users/{id}` (admin only). User: `{id, username, full_name, role, email, is_active, last_login_at}`.
- `GET /roles` → `[{name, permissions: [string]}]`.
- `GET /audit-logs?user_id=&page=` → `{id, timestamp, user_id, username, action, entity_type, entity_id, ip_address, details}`.
- `GET /escalation-rules`, `POST /escalation-rules`, `PUT /escalation-rules/{id}` (admin). Rule: `{id, name, enabled, trigger_overdue_days, escalate_to_role, notify_channel, created_at}`.
- `GET /settings`, `PUT /settings` (admin) → key/value system settings.

## Escalation engine (backend service)

On a schedule (or on each `GET /cases` call lazily): for each open case past due_date, if an enabled escalation rule matches, create an `escalation_log` row + a STAFF notification to the target role + an ESCALATION case event. Idempotent per (case, rule, day).

## Demo credentials (seeded)

| username | password | role |
|---|---|---|
| admin | Admin@12345 | admin |
| dr.smith | Clinician@123 | clinician |
| nurse.jones | Nurse@12345 | nurse |
| coordinator.lee | Coord@12345 | coordinator |
| viewer.demo | Viewer@12345 | viewer |
