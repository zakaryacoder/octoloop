# OCTOLOOP V2 — Security Model

This document describes the V2 security model: RBAC permission matrix, auth/session flow,
security headers, CORS, and known residual risks. Base path: `/api/v1`.

## 1. Authentication & sessions (Phase 3)

- **Access tokens**: JWT (HS256), TTL **15 minutes** (`ACCESS_TOKEN_EXPIRE_MINUTES=15`).
  Payload: `sub=user_id, role, username, exp`.
- **Refresh tokens**: opaque random (`secrets.token_urlsafe(48)`), TTL **7 days**, stored
  **only as a SHA-256 hash** in `refresh_tokens(token_hash, family_id, expires_at, revoked_at, replaced_by)`.
  Returned to the client once at login/refresh; never stored plain, never logged.
- **Rotation**: `POST /auth/refresh` issues a new access + new refresh token. The old
  refresh token is marked `revoked_at=now, replaced_by=<new_id>`.
- **Family-reuse detection**: all tokens issued in one rotation chain share a `family_id`.
  If a revoked token is reused, **every token in that family is revoked** (401).
- **Logout**: `POST /auth/logout` (optional `refresh_token` body) revokes that token.
  `POST /auth/logout-all` revokes all of the user's active refresh tokens. Both write audit logs.
- **Persistent lockout**: `users.failed_login_count` + `users.locked_until`. 5 failed
  attempts (`MAX_LOGIN_FAILS=5`) → 15-minute lock (`LOCKOUT_MINUTES=15`) → HTTP **423 Locked**.
  Persists across restart. Successful login resets the counter.
- **Rate limit**: sliding 60s window per `(ip, username)`, default 20/min
  (`LOGIN_RATE_LIMIT_PER_MINUTE`) → HTTP **429 Too Many Requests**.
- **Password policy** (enforced on user create/update): min 8 chars, upper+lower+digit+symbol
  → HTTP 422 with detail. Demo credentials meet the policy.
- **Startup secret check**: if `ENV=production` and `SECRET_KEY` is default, empty, or
  shorter than 32 chars, the app **refuses to start**.
- **DATABASE_URL validation**: malformed/unsupported driver → fail-fast at startup with
  a clear message. SQLite default preserved; PostgreSQL via `postgresql+psycopg2://...`.
- **Logging**: secrets, tokens, password hashes, and PHI are never logged. Unhandled
  exceptions return a generic `{"detail":"Internal server error."}` (no leak).

Supported auth modes: **Bearer token + refresh rotation** (default, used by SPA).
`USE_COOKIE_AUTH=true` (HttpOnly cookie + CSRF double-submit) is documented but NOT the
default and not wired into the SPA; switching would require CSRF handling.

## 2. RBAC permission matrix (Phase 2)

Enforced via `require_perm("<permission>")` dependency on every protected endpoint.
Unauthenticated → 401; authenticated but missing permission → 403.

Permission strings:
`patients:read|create|update`, `screenings:read|create|record|assign`,
`cases:read|create|update|assign|escalate|close`, `referrals:read|create|manage`,
`appointments:read|create|manage`, `notifications:read|send`, `users:manage`,
`roles:read`, `audit:read`, `settings:manage`, `escalation_rules:manage`,
`population:read`, `portal:self`.

| Permission → | admin | clinician | coordinator | nurse | viewer | patient |
|---|---|---|---|---|---|---|
| patients:read/create/update | ✅ | ✅ | ✅ | ✅/✅/✅ | read only | ❌ |
| screenings:read/create | ✅ | ✅ | ✅ | ✅ | read only | ❌ |
| screenings:record | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| screenings:assign | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| cases:read/create/update/assign | ✅ | ✅ | ✅ | ✅ | read only | ❌ |
| cases:escalate | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **cases:close** | ✅ | ✅ | ✅ | **❌** | **❌** | **❌** |
| referrals:read/create/manage | ✅ | ✅ | ✅ | read only | read only | ❌ |
| appointments:read/create/manage | ✅ | ✅ | ✅ | read only | read only | ❌ |
| notifications:read/send | ✅ | ✅ | ✅ | ✅/✅ | read only | ❌ |
| users:manage | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| settings:manage | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| escalation_rules:manage | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| roles:read / audit:read / population:read | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| portal:self | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ (only) |

Key restrictions:
- **Case closure** (`POST /cases/{id}/close`) requires `cases:close` → 403 for nurse/viewer/patient.
- **User management** (`/users` mutating), `/settings` mutating, `/escalation-rules` mutating
  require `users:manage` / `settings:manage` / `escalation_rules:manage` → admin only.
- **Viewer** is strictly read-only on all mutating endpoints.
- **Patient** role has only `portal:self` and may only access `/portal/*` scoped to
  `users.patient_id`. Any attempt to read staff endpoints or another patient → 403.
- `GET /roles` returns `[{name, permissions:[...]}]` for the live matrix.

## 3. Security headers & CSP

Middleware adds to every response:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'`
  (inline styles allowed for Tailwind dev; tighten in production build.)
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` **only when `HTTPS=true`**.

## 4. CORS

- Origins from `CORS_ORIGINS` (comma-separated). `allow_credentials=true`.
- Wildcard `*` is added **only if `ALLOW_CORS_WILDCARD=true`** (dev convenience; default
  `false`; `.env.example` sets it `true` for local demo with a comment). With wildcard,
  `allow_credentials` is disabled (incompatible with `*`). Production must set explicit origins.

## 5. Notifications delivery honesty

- Provider architecture: `NOTIFICATION_EMAIL_PROVIDER` (`none`|`smtp`),
  `NOTIFICATION_SMS_PROVIDER` (`none`|`twilio`). In-app PORTAL always delivered immediately.
- If a provider is `none` (default), the notification is marked **`QUEUED`** with a
  `delivery_logs` entry `"no provider configured — not sent"`. **Never marked `SENT`
  unless a real provider accepted it.**
- Real providers: SMTP via stdlib `smtplib`, Twilio via `httpx` POST to the REST API.
  Failed sends retry up to 3 times with exponential backoff, then status `FAILED` + delivery log.
- `notification_preferences(user_id, channel_enabled)` per user; `GET/PUT /notifications/preferences`.

## 6. AI safety (Phase 7)

- Deterministic fallback is **mandatory and always available**. Optional LLM
  (`LLM_PROVIDER=openai|anthropic`, default `none`) sends only **case metadata + event
  types** (never notes/PHI) with a 10s timeout; on any error → deterministic fallback.
- Every AI response includes a disclaimer. AI never diagnoses, prescribes, closes cases,
  or fabricates PHI. `POST /ai/query-dashboard` is deterministic keyword-routed.

## 7. Known residual risks (honest)

1. **No real SMS/email gateway in the demo.** `QUEUED` notifications require a configured
   provider (SMTP host/creds or Twilio SID/token in env) to actually deliver. Without one,
   they remain queued. SMTP/Twilio code paths are implemented but untested against live gateways.
2. **PostgreSQL runtime not exercised in this environment.** SQLite is used for dev/demo
   and tests. Alembic V2 migration (`v2_schema_001`) targets both (batch mode for SQLite);
   validate on a real Postgres instance before production.
3. **Rate limiting is in-memory** (per-process). Multi-worker / multi-node deployments need
   a shared store (Redis) or edge rate limiting. Persistent lockout (DB) is multi-node safe.
4. **`USE_COOKIE_AUTH` mode** is documented but not wired into the SPA; enabling it requires
   adding CSRF double-submit handling to the frontend. Bearer+refresh is the supported path.
5. **CSP `unsafe-inline`** for scripts/styles is present for Tailwind/Next dev. A production
   build should use nonces or hashes to remove `unsafe-inline`.
6. **Escalation scheduler** (`APScheduler`) is opt-in (`ENABLE_SCHEDULER=true`); without it,
   escalation runs lazily on `GET /cases` or via external cron hitting `POST /escalation/run`.
7. **LLM path** is implemented via direct HTTP to OpenAI/Anthropic APIs but not tested with
   real keys; deterministic fallback is always exercised and is the default.
8. **Backup/restore**: use `sqlite3 octoloop.db ".backup ..."` (SQLite) or `pg_dump` (Postgres).
   Store backups encrypted; they contain PHI. Restore offline, then run `alembic upgrade head`.
