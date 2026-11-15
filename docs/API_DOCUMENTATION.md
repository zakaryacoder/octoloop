# OCTOLOOP API Documentation (V2)

Base path: `/api/v1`. Auth: `Authorization: Bearer <jwt>`. V1 endpoints are backward
compatible; V2 adds fields/endpoints. All timestamps ISO-8601 UTC. Errors: `{"detail":"..."}`.

Demo credentials (seeded):

| username | password | role |
|---|---|---|
| admin | Admin@12345 | admin |
| dr.smith | Clinician@123 | clinician |
| nurse.jones | Nurse@12345 | nurse |
| coordinator.lee | Coord@12345 | coordinator |
| viewer.demo | Viewer@12345 | viewer |
| **patient.ross** | **Patient@12345** | patient (portal, linked to seeded patient OCT-1000) |

## Auth (V2 extended)

| Method | Path | Body / Params | Returns | Notes |
|---|---|---|---|---|
| POST | `/auth/login` | `{username, password}` | `{access_token, token_type:"bearer", user, refresh_token, expires_in:900}` | V2 adds refresh_token + expires_in. 423 locked / 429 rate-limited. |
| POST | `/auth/refresh` | `{refresh_token}` | `{access_token, refresh_token, expires_in}` | Rotation; old token revoked. Reuse of revoked → whole family revoked (401). |
| POST | `/auth/logout` | optional `{refresh_token}` | `{ok:true}` | Revokes that refresh token + audit. |
| POST | `/auth/logout-all` | — | `{ok:true, revoked:N}` | Revokes all user's refresh tokens. |
| GET | `/auth/me` | — | current user | |

## Patients (V2: permission-gated + instructions)

- `GET /patients?search=&page=&page_size=` → `{items, total, page, page_size, pages}` (requires `patients:read`)
- `POST /patients` → 201 (`patients:create`)
- `GET /patients/{id}` → patient + screenings/cases/referrals/appointments (`patients:read`)
- `PUT /patients/{id}` → updated (`patients:update`)
- `POST /patients/{id}/instructions` body `{instruction}` → 201, staff-entered patient-facing instruction (`patients:update`); visible read-only in portal.

## Screenings (`screenings:*` perms)

- `GET /screenings?patient_id=&type=&classification=&page=&page_size=` → paginated
- `POST /screenings` → 201 (`screenings:create`)
- `POST /screenings/{id}/result` → screening + auto-created case if actionable (`screenings:record`; nurse/viewer → 403)
- `POST /screenings/{id}/assign` body `{clinician_id}` (`screenings:assign`)

## Follow-up Cases (`cases:*` perms) — V2 analytics fixes

- `GET /cases?status=&priority=&responsible_id=&overdue_only=true&patient_id=&search=&page=&page_size=` → `{items, total, page, page_size, pages}`. **All filters at SQL level; overdue = `due_date < today AND status != CLOSED` in query; total computed AFTER filtering.** (`cases:read`)
- `GET /cases/overdue` → list (SQL-level overdue filter) (`cases:read`)
- `POST /cases` → 201 (`cases:create`)
- `GET /cases/{id}` → detail with events/referrals/appointments/patient/screening (`cases:read`)
- `GET /cases/{id}/escalations` → `[{id, case_id, rule_id, level, trigger_date, detail, created_at}]` escalation history (`cases:read`). Never auto-closes.
- `PUT /cases/{id}` body `{priority?, responsible_id?, due_date?, next_action?}` (`cases:update`)
- `POST /cases/{id}/advance` body `{to_status, note?}` (`cases:update`)
- `POST /cases/{id}/events` body `{event_type, note, contact_outcome?}` → 201 (`cases:update`)
- `POST /cases/{id}/close` body `{closure_reason, note}` → **requires `cases:close`** (nurse/viewer/patient → 403). Only human endpoint may close; AI/automation never can.

## Referrals (`referrals:*`) / Appointments (`appointments:*`)

- Referrals: `GET /referrals?status=&page=`, `POST /referrals` (`referrals:create`), `POST /referrals/{id}/send|accept|reject|complete` (`referrals:manage`).
- Appointments: `GET /appointments?date_from=&date_to=&status=&patient_id=&case_id=&page=`, `POST /appointments` (`appointments:create`), `PUT /appointments/{id}` (reschedule), `POST /appointments/{id}/cancel|complete` (`appointments:manage`).

## Notifications (V2: provider architecture + preferences + delivery logs)

- `GET /notifications?audience=&status=&case_id=&page=` → paginated (`notifications:read`)
- `POST /notifications/send` body `{audience, patient_id?, staff_user_id?, case_id?, channel, subject, message}` → 201. **Status = `SENT` only if a real provider accepted; `QUEUED` + delivery log "no provider configured" when provider=none; `FAILED` on provider error.** (`notifications:send`)
- `GET /notifications/staff/unread` → list (`notifications:read`)
- `POST /notifications/{id}/acknowledge` → ACKNOWLEDGED
- `GET /notifications/preferences`, `PUT /notifications/preferences` body `{channel_enabled:{...}}`
- `GET /notifications/{id}/delivery-logs` → `[{provider, status, detail, attempts, created_at}]` (`notifications:read`)

## Dashboard / Analytics (`cases:read`)

- `GET /dashboard/summary` → KPIs + volume by month + cases by status + overdue by responsible + recent activity.
- `GET /analytics/overview`, `/analytics/screening-volume?months=`, `/analytics/timeliness`, `/analytics/lost-to-followup`.

## AI (V2: deterministic fallback mandatory + optional LLM + query-dashboard)

- `POST /ai/summarize-case` body `{case_id}` → `{summary (incl DISCLAIMER), overdue, missing_steps, suggested_next_actions, risk_flags}` (`cases:read`)
- `GET /ai/operational-insights` → `{insights, top_overdue_cases, bottlenecks}` (`cases:read`)
- `POST /ai/query-dashboard` body `{question}` → `{answer, routed_to: population|dashboard|escalation|unknown, data, disclaimer}`. Deterministic keyword routing; optional LLM (PHI-minimized, 10s timeout, fallback on any error). Never diagnoses/prescribes/closes/fabricates PHI. (`cases:read`)

## Population Health Intelligence (V2 Phase 5) — `population:read` only

All endpoints return **aggregated, anonymized** operational metrics — no patient identifiers.
Labeled operational (not clinical) risk.

- `GET /population/overview` → `{screening_coverage_rate, abnormal_rate, follow_up_completion_rate, avg_days_to_consultation, delayed_care_count, referral_completion_rate, by_type:[{type, screenings, abnormal, completion_rate}], disclaimer}`
- `GET /population/coverage?type=&from=&to=` → monthly `[{month, total, abnormal, coverage_rate}]`
- `GET /population/geographic` → `[{region, screening_count, abnormal_count, completion_rate, overdue_rate}]` (synthetic regions from address district)
- `GET /population/delayed-care` → `[{screening_type, bucket_days, count}]`
- `GET /population/trends?months=12` → monthly KPIs
- `GET /population/export?format=csv` → CSV download (`Content-Disposition: attachment`), same aggregated data. PDF not implemented (CSV only).

## Patient Portal (V2 Phase 9) — `portal:self` + role=patient, strict own-record

All scoped to `current_user.patient_id`; any cross-access → 403. Never exposes internal
notes/events, other patients, AI medical advice, or the staff dashboard.

- `GET /portal/me` → `{mrn, first_name, last_name, date_of_birth, gender, phone, email}`
- `GET /portal/appointments` → `[{department, clinician_name, scheduled_at, status}]`
- `GET /portal/referrals` → `[{to_department, status, reason}]` (no internal notes)
- `GET /portal/follow-ups` → open cases `[{case_ref, screening_type, status, next_action, due_date}]` (no internal events/notes)
- `GET /portal/notifications` → patient-facing notifications
- `GET /portal/instructions` → staff-entered instructions (read-only)
- `GET /portal/contact-info` → facility contact `{facility_name, phone, email, hours}`

## Admin / Settings (V2: permission-gated)

- `GET /users`, `POST /users`, `PUT /users/{id}` → **`users:manage`** (admin only). Password policy enforced (422 on weak).
- `GET /roles` → `[{name, permissions:[...]}]` (`roles:read`)
- `GET /audit-logs?user_id=&page=` → `audit:read`
- `GET /escalation-rules` (any auth), `POST/PUT /escalation-rules/{id?}` → **`escalation_rules:manage`** (admin). Rule includes `level` (1/2/3).
- `GET /settings` (any auth), `PUT /settings` → **`settings:manage`** (admin).

## Escalation engine (V2 Phase 6)

Multi-level L1→responsible nurse, L2→coordinator, L3→admin/clinician supervisor.
Idempotent per `(case_id, rule_id, level, calendar day)`; writes `escalation_logs` +
STAFF notification (dispatched honestly) + ESCALATION case event. **Never auto-closes.**
- Scheduler: `APScheduler BackgroundScheduler` every 5 min **only if `ENABLE_SCHEDULER=true`**.
- External cron hook: `POST /escalation/run` (no auth prefix — protect via reverse proxy/secret) → `{ok, escalations_created}`.
- History: `GET /cases/{id}/escalations`.

## Health & meta

- `GET /health` → `{status:"ok", service, version:"2.0.0"}`
- Security headers: `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, CSP, HSTS (when `HTTPS=true`).
- CORS: explicit origins from `CORS_ORIGINS`; wildcard `*` only if `ALLOW_CORS_WILDCARD=true` (default false).
