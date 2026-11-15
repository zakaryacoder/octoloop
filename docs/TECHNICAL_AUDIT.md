# OCTOLOOP V1 Technical Audit (pre-V2) — issues + remediation

Audit of `OCTOLOOP/` V1 baseline (git commit `e0f7fcf`). Every issue below is addressed by a V2 phase.

## Architecture summary
- Frontend: Next.js 14 App Router, client-side fetch, Bearer JWT in localStorage, 13 routes, shadcn-style components, Recharts.
- Backend: FastAPI, SQLAlchemy 2, Pydantic, 15 tables, ~56 endpoints under `/api/v1`, JWT (python-jose), bcrypt (passlib), role-check dependency (`require_roles`), in-memory login lockout, lazy escalation.
- DB: SQLite portable demo default; PostgreSQL supported via `DATABASE_URL`; Alembic initial migration present.
- AI: deterministic offline rule-based ops helpers with disclaimer.
- Tests: 41 pytest passing; frontend `next build` green.

## Issues & solutions

| # | Severity | Area | Issue | V2 fix |
|---|---|---|---|---|
| 1 | High | Auth | No refresh tokens; access token long-lived (480min); logout does not invalidate token | §1 refresh rotation + revocation + family-reuse detection, 15min access |
| 2 | High | Auth | Login lockout in-memory (resets on restart) | persistent `failed_login_count`/`locked_until` + rate limit |
| 3 | High | RBAC | Only role-level checks (`require_roles`), no granular permissions; no `cases:close`-style restriction; Viewer not strictly read-only on all mutating endpoints; no patient role | permission strings + `require_perm` on every endpoint; matrix; patient role |
| 4 | High | Authz | No resource-level checks; any authenticated user could in theory access any patient; no patient self-service isolation | portal endpoints scoped to `users.patient_id`; 403 on cross-access |
| 5 | Med | Security | CORS includes `*` wildcard alongside env origins | explicit origins only; wildcard behind `ALLOW_CORS_WILDCARD` dev flag |
| 6 | Med | Security | No security headers; no password strength policy; no CSP | middleware headers; password policy; CSP |
| 7 | Med | Secrets | No startup check for weak/default `SECRET_KEY` in production | fail startup if `ENV=production` and secret default/short |
| 8 | Med | Analytics | `GET /cases` filters verified at SQL level in V1 but total-count-after-filter and pagination metadata consistency not uniformly enforced; some analytics computed in Python after loading rows | enforce all filters + count at SQL; consistent `{items,total,page,page_size,pages}`; regression tests |
| 9 | Med | Escalation | Runs lazily only on `GET /cases`; single-level; no scheduled execution; idempotency exists but no multi-level | APScheduler (opt-in) + external cron hook; L1/L2/L3; history endpoint |
| 10 | Med | Notifications | Status set to `SENT` directly with no real gateway — misrepresents delivery | provider architecture; `QUEUED` when no provider; `delivery_logs`; retry; preferences; never fake `SENT` |
| 11 | Low | AI | Deterministic only; no optional LLM path; no NL dashboard query | optional LLM with PHI-minimization + timeout + deterministic fallback; `/ai/query-dashboard` |
| 12 | Low | DB | Few explicit indexes on hot query paths; no `DATABASE_URL` validation | indexes on hot columns; startup validation; new Alembic migration |
| 13 | Low | i18n | English only; no RTL | next-intl en/fr/ar; RTL layout |
| 14 | Low | Patient access | No patient-facing portal | `/portal/*` endpoints + frontend portal section |
| 15 | Low | UI gaps | No patient-edit form, no screening-assign button, case priority/responsible editable via API only, operational-insights not surfaced | complete all UI wired to real endpoints |
| 16 | Low | Population | No aggregated population health module | `/population/*` (anonymized aggregates + CSV export) + dashboard page |
| 17 | Low | Deploy | No Docker | Dockerfiles + docker-compose (Postgres) + DEPLOYMENT.md |
| 18 | Info | Tests | No RBAC/refresh/lockout/population/portal-isolation tests | pytest additions (Phase 14) |

## Verified non-issues
- Password hashing: bcrypt via passlib (strong).
- SQL injection: SQLAlchemy ORM parameterized throughout.
- XSS: React auto-escapes; no `dangerouslySetInnerHTML` found in app code.
- Input validation: Pydantic (backend) + Zod (frontend) on all forms.
- Audit logging: present for auth + mutations.
- Secrets: no secrets committed; `.env` gitignored.

All remediations are scoped in `docs/V2_CONTRACT.md`.
