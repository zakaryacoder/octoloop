# OCTOLOOP Changelog

## [V2] — 2026-11-13
### Added
- **RBAC with granular permissions**: permission strings + `require_perm()` on every protected endpoint; roles Admin/Clinician/Nurse/Coordinator/Viewer/Patient; permission matrix (docs/SECURITY.md). Case closure restricted to authorized roles; user management admin-only.
- **Auth hardening**: 15-min access tokens + 7-day rotating refresh tokens with revocation + reuse family detection; logout invalidates tokens; persistent DB-backed login lockout + rate limiting; password strength policy; security headers + CSP; production secret check at startup.
- **Population Health Intelligence module**: `/population/*` aggregated anonymized endpoints (overview, coverage, geographic, delayed-care, trends) + CSV export; frontend `/population` dashboard.
- **Intelligent escalation engine**: multi-level L1/L2/L3 rules; opt-in APScheduler + external cron hook; idempotent; escalation history; never auto-closes.
- **AI operational intelligence upgrade**: deterministic fallback mandatory; optional LLM with PHI minimization + timeout; `/ai/query-dashboard` NL dashboard queries; disclaimers on all responses.
- **Patient portal**: `/portal/*` backend endpoints with strict own-record isolation; frontend `/portal` section (appointments, referrals, follow-ups, notifications, instructions).
- **Multilingual**: English / French / Arabic with RTL layout; language selector; persistent preference.
- **Notifications provider architecture**: in-app + email/SMS-ready; `QUEUED` (not falsely `SENT`) when no provider; delivery logs; retry; user preferences.
- **Docker**: `Dockerfile.backend`, `Dockerfile.frontend`, `docker-compose.yml` (PostgreSQL + migrate + backend + frontend) with health checks; `docs/DEPLOYMENT.md`.
- **DB**: indexes on hot columns; `DATABASE_URL` validation; Alembic V2 migration.
- **Frontend UX completion**: patient edit form, screening assign, case priority + responsible edit, operational-insights panel, notification preferences, confirmation dialogs, improved mobile/accessibility.
- **Docs**: `docs/TECHNICAL_AUDIT.md`, `docs/SECURITY.md`, `docs/DEPLOYMENT.md`, `docs/API_DOCUMENTATION.md`.
### Fixed
- CORS wildcard removed by default (behind `ALLOW_CORS_WILDCARD` dev flag).
- `/cases` filters + total count enforced at SQL level; consistent pagination metadata.
- V1 datetime naive/aware TypeError (analytics + AI) — regression tests added.
- V1 admin users tab paginated `.items` unwrap.
### Security
- No secrets committed; `.env` gitignored; demo credentials documented and must be changed in production.

## [V1] — 2026-11-13
Initial release: full-stack screening follow-up platform, 10 modules, 15 tables, 41 pytest, 12 screenshots, `OCTOLOOP_FINAL.zip`.

## V2.1 (submission polish)
- Locale-aware enum labels (EN/FR/AR) through `humanize()`; locale-aware dates/times/relative time (no hardcoded `en-GB`).
- `GET /ready` readiness probe; `npm run check:i18n` message-parity check.
- README limitations rewritten to match the current state; removed debug/one-off scripts and the committed demo database (`python scripts/init_db.py` creates it).
- New docs: TECHNICAL_DOCUMENTATION, RESPONSIBLE_AI, COMMERCIAL_AND_PILOT, DEMO_SCRIPT_3MIN.
- `tx()` phrase dictionaries (FR/AR) for ~380 UI phrases incl. validation messages; `/impact` page (baseline vs current, baseline entered by the user with a required source); notification help text corrected (queued, never faked as sent).
