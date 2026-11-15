# OCTOLOOP V2 — Frozen Contract Extensions (build against this exactly)

Build on the V1 project at `OCTOLOOP/`. Do NOT break V1 endpoints; extend. All V1 enums/shapes stand. Visual identity unchanged (navy #12304A / teal #13A89E / #F5F8FB / white cards / rounded-xl / soft shadows).

## 1. Auth & sessions (Phase 3) — BACKWARD COMPATIBLE
- `POST /auth/login` still returns `{access_token, token_type:"bearer", user}`. V2 ADDS `refresh_token` and `expires_in` (900). Access token TTL = 15 min. Refresh token TTL = 7 days, opaque random, stored **hashed** in `refresh_tokens(id, user_id, token_hash, expires_at, revoked_at, created_at, replaced_by)`.
- `POST /auth/refresh` body `{refresh_token}` → `{access_token, refresh_token, expires_in}`. **Rotation**: old refresh token marked revoked (replaced_by=new). Reuse of a revoked token → revoke entire family (security). 401 if invalid/revoked/expired.
- `POST /auth/logout` body optional `{refresh_token}` → revokes that token; also writes audit. `POST /auth/logout-all` revokes all user's refresh tokens.
- Frontend keeps **Bearer token** (SPA default). `lib/api.ts`: on 401, attempt one refresh using stored refresh_token; on success retry original request; on refresh failure → clear session → /login. HttpOnly-cookie + CSRF double-submit mode is implemented behind env `USE_COOKIE_AUTH=true` (documented) but NOT default — do NOT switch the SPA to cookies (would require CSRF; Bearer+refresh is the supported path).
- **Persistent lockout**: `users.failed_login_count` + `users.locked_until` (or `login_attempts` table). 5 fails → 15 min lock (423 Locked / 401 with detail). Persists across restart. Login rate-limit per (ip, username) (e.g. 10/min → 429).
- **Password policy** (validate on user create/update + patient self-service): min 8 chars, upper+lower+digit+symbol. 422 with detail. Existing demo passwords meet it.
- **Security headers** middleware: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, CSP (default-src 'self'; allow inline styles for Tailwind dev; documented), HSTS only when `HTTPS=true`. Never log secrets/password hashes/tokens/PHI.
- **CORS**: origins from `CORS_ORIGINS` env (comma-separated). Wildcard `*` ONLY if `ALLOW_CORS_WILDCARD=true` (dev convenience, default false; .env.example sets it for local demo with a comment). Production must set explicit origins.

## 2. RBAC (Phase 2) — permission strings, enforced backend-side
- Permission model: `permissions(name)` + `role_permissions(role, permission)`. Permission strings: `patients:read|create|update`, `screenings:read|create|record|assign`, `cases:read|create|update|assign|escalate|close`, `referrals:read|create|manage`, `appointments:read|create|manage`, `notifications:read|send`, `users:manage`, `roles:read`, `audit:read`, `settings:manage`, `escalation_rules:manage`, `population:read`, `portal:self`.
- Roles & default grants:
  - `admin` → all permissions.
  - `clinician` → all except `users:manage`, `settings:manage`, `escalation_rules:manage`; HAS `cases:close`.
  - `coordinator` → full follow-up workflow incl `cases:close`, `referrals:*`, `appointments:*`, `notifications:send`; no `screenings:record`, no user/settings/rules management.
  - `nurse` → read + create/update assigned records, `notifications:send`; NO `cases:close`, NO `screenings:record`.
  - `viewer` → `*:read` only (no write).
  - `patient` (NEW) → `portal:self` only.
- Enforce via `require_perm("cases:close")` dependency on EVERY protected endpoint (not just role check). Unauthenticated → 401; authenticated but missing perm → 403.
- **Case closure** (`POST /cases/{id}/close`) requires `cases:close` → 403 for nurse/viewer/patient. **User management** (`/users`, `/roles`, `/settings`, `/escalation-rules` mutating) requires `users:manage`/`settings:manage`/`escalation_rules:manage` → admin only. **Resource-level**: `patient` role may only access `/portal/*` scoped to `users.patient_id`; any attempt to read another patient → 403.
- `GET /roles` returns `[{name, permissions:[...]}]`. Publish matrix in docs/SECURITY.md.

## 3. Analytics fixes (Phase 4)
- `GET /cases`: ALL filters (`status`, `priority`, `responsible_id`, `overdue_only=true`, `patient_id`, `search` on patient_name/case_ref) applied at SQL level. `overdue` computed in query (`due_date < :now AND status != 'CLOSED'`). `total` count computed AFTER filtering (subquery). Pagination metadata `{items, total, page, page_size, pages}` consistent across all list endpoints. No loading full table into memory.
- Re-verify dashboard KPIs, overdue, completion rates, screening stats, referral stats, timeliness against real records. Regression tests: filter+count consistency, overdue-before-pagination.

## 4. Population Health Intelligence (Phase 5) — aggregated, anonymized ONLY
All endpoints require `population:read`. All return aggregates; NO patient identifiers. Label operational (not clinical) risk.
- `GET /population/overview` → `{screening_coverage_rate, abnormal_rate, follow_up_completion_rate, avg_days_to_consultation, delayed_care_count, referral_completion_rate, by_type:[{type, screenings, abnormal, completion_rate}]}`.
- `GET /population/coverage?type=&from=&to=` → monthly coverage series.
- `GET /population/geographic` → `[{region, screening_count, abnormal_count, completion_rate, overdue_rate}]` (synthetic operational regions derived from patient address district; no IDs).
- `GET /population/delayed-care` → `[{screening_type, bucket_days, count}]`.
- `GET /population/trends?months=12` → monthly KPIs.
- `GET /population/export?format=csv` → CSV download (Content-Disposition), same aggregated data. PDF optional; if not, document CSV-only.

## 5. Escalation engine (Phase 6)
- `escalation_rules` gains `level` (1/2/3), `trigger_overdue_days`, `escalate_to_role`, `notify_channel`, `enabled`. Multi-level: L1→responsible nurse, L2→coordinator, L3→authorized supervisor (admin/clinician).
- `run_escalation_checks(db)` idempotent per (case_id, rule_id, level, date) — writes `escalation_logs` + STAFF notification + ESCALATION case event. Scheduler: APScheduler `BackgroundScheduler` started if `ENABLE_SCHEDULER=true` (every 5 min); else exposed for external cron (documented). NEVER auto-close. `GET /cases/{id}/escalations` returns history.

## 6. AI operational intelligence (Phase 7)
- Deterministic fallback ALWAYS available. Optional LLM: `LLM_PROVIDER` env (`none` default; if `openai`/`anthropic`, key in env, 10s timeout, send only case metadata + event types (not full notes/PHI), on any error → deterministic fallback). Document data-processing implications.
- Existing `POST /ai/summarize-case` + `GET /ai/operational-insights` upgraded (delay identification, bottleneck analysis, prioritization). NEW `POST /ai/query-dashboard` body `{question}` → deterministic keyword-routed operational answer (routes to population/dashboard/escalation data). ALWAYS includes limitations disclaimer. NEVER diagnoses/prescribes/closes/fabricates PHI. Safety tests assert disclaimer present and no auto-close.

## 7. Notifications (Phase 12)
- Provider architecture: `NOTIFICATION_EMAIL_PROVIDER` (`none`|`smtp`), `NOTIFICATION_SMS_PROVIDER` (`none`|`twilio`). In-app always. If provider=none, status = `QUEUED` with `delivery_logs` entry "no provider configured — not sent". **Never mark SENT unless a real provider accepted it.** `delivery_logs(id, notification_id, provider, status, detail, attempts, created_at)`. Retry with backoff (max 3) for failed provider sends. `notification_preferences(user_id, channel_enabled jsonb)`. `GET /notifications/preferences`, `PUT /notifications/preferences`. History retained.

## 8. Patient portal (Phase 9) — backend endpoints
- `users.patient_id` FK nullable; role=`patient`. All `/portal/*` require role patient + `portal:self`, filtered by `current_user.patient_id`. 403 otherwise.
- `GET /portal/me` → own profile (name, DOB, contact, MRN).
- `GET /portal/appointments` → own appointments (department, clinician, scheduled_at, status).
- `GET /portal/referrals` → own referrals (to_department, status, reason — no internal notes).
- `GET /portal/follow-ups` → own open follow-ups (case_ref, screening_type, status, next_action, due_date — NO internal notes/events).
- `GET /portal/notifications` → own patient-facing notifications.
- `GET /portal/instructions` → staff-entered instructions (read-only; created by authorized staff via `POST /patients/{id}/instructions` with `entered_by`).
- `GET /portal/contact-info` → responsible facility contact details.
- Never expose internal admin notes, other patients, AI medical advice, or the staff dashboard.

## 9. DB & scalability (Phase 10)
- New Alembic migration for: `permissions`, `role_permissions`, `refresh_tokens`, `notification_preferences`, `delivery_logs`, `users` columns (failed_login_count, locked_until, patient_id), `escalation_rules.level`. Indexes: `cases(status, due_date)`, `cases(responsible_id)`, `screenings(patient_id)`, `notifications(audience, staff_user_id)`, `audit_logs(created_at)`, `refresh_tokens(token_hash)`. Validate `DATABASE_URL` at startup (fail with clear message if malformed). SQLite dev/demo preserved; PostgreSQL target via env. `scripts/init_db.py` must also seed permissions/role_permissions/patient portal demo user (patient: `patient.ross` / `Patient@12345`, linked to a seeded patient). Do not destroy existing demo data.

## 10. Frontend V2 contract (Phase 8,9,11 + 5 UI)
- next-intl: locales `en`, `fr`, `ar`; `[locale]` routing or middleware; RTL for `ar` (dir=rtl, font, spacing). Language selector in topbar; preference persisted (localStorage + cookie). Translate nav, dashboard labels, forms, validation messages, notifications. Do NOT translate DB identifiers/API field names. Build must stay green.
- Patient portal: `/portal` routes (separate minimal layout — no staff sidebar). Login page role-aware (patient credentials → /portal). Pages: overview, appointments, referrals, follow-ups, notifications, instructions. All via /portal/* endpoints.
- Complete missing UI (all real endpoints): patient edit form (PUT /patients/{id}), screening assign button (POST /screenings/{id}/assign), case priority + responsible edit (PUT /cases/{id}), operational-insights panel on dashboard (GET /ai/operational-insights), notification preferences.
- Population dashboard: `/population` page (charts + geographic region list/bar chart + filters + CSV export button hitting /population/export). Label "Operational — aggregated & anonymized".
- `lib/api.ts`: refresh-token auto-retry (per §1). No fake buttons.

## 11. Tests (Phase 14) — must actually pass
pytest additions: RBAC (401/403/authorized/cross-role/case-close restriction/user-mgmt restriction), refresh rotation+revocation+reuse-family-revoke, persistent lockout, analytics filter-at-SQL + total-after-filter, population aggregation (assert no patient_id in payload), escalation idempotency, AI disclaimer + no-close, portal isolation (patient A cannot read patient B), CORS no-wildcard-by-default. Frontend: `tsc --noEmit` + `npm run build` exit 0.
