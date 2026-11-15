# OCTOLOOP — Deployment Guide

## Local (Windows 11 / Linux / macOS) — zero-config demo
See `README.md`. Uses SQLite. `scripts\start_all.bat` (Windows) or manual:
```bash
pip install -r backend/requirements.txt
python scripts/init_db.py
cd backend && uvicorn app.main:app --port 8000   # terminal 1
cd frontend && npm install && npm run dev          # terminal 2
```

## Docker Compose (production-like, PostgreSQL)
Requires Docker + Compose.
```bash
# set secrets in .env (never commit): SECRET_KEY, POSTGRES_PASSWORD
cp .env.example .env   # then edit
docker compose up --build
# → frontend http://localhost:3000 , backend http://localhost:8000/docs
# migrate service runs init_db.py (tables + demo seed) on first boot.
```
Services: `db` (Postgres 16, persistent volume `pgdata`), `migrate` (one-shot seed), `backend` (uvicorn, healthcheck, scheduler enabled), `frontend` (next start, healthcheck).

## Production hardening checklist
- Set `ENV=production`, a ≥32-char random `SECRET_KEY` (backend refuses to start otherwise).
- `ALLOW_CORS_WILDCARD=false`; set `CORS_ORIGINS` to your exact frontend origin(s).
- Put both services behind HTTPS (TLS termination at reverse proxy); HSTS enabled when `HTTPS=true`.
- Use PostgreSQL (not SQLite). Back up `pgdata` volume regularly (`pg_dump`).
- Configure real notification providers: `NOTIFICATION_EMAIL_PROVIDER=smtp` + SMTP env vars; `NOTIFICATION_SMS_PROVIDER=twilio` + Twilio creds. Without these, notifications stay `QUEUED` (never falsely `SENT`).
- Optional LLM: `LLM_PROVIDER=openai|anthropic` + key; sends only case metadata + event types (minimal PHI); falls back to deterministic on error/timeout.
- Rotate `SECRET_KEY` invalidates all sessions; use `POST /auth/logout-all` per user if needed.
- Audit logs (`GET /audit-logs`, admin only) should be shipped to an external SIEM in production.

## Backup & restore
- PostgreSQL: `docker compose exec db pg_dump -U octoloop octoloop > backup.sql`; restore with `psql < backup.sql`.
- SQLite demo: copy `database/octoloop.db`.
- Alembic: `cd database && alembic upgrade head` for schema migrations; `init_db.py` is for fresh installs only.

## Known deployment limitations
- Login lockout counter is DB-persistent (V2); refresh-token family stored hashed in DB.
- No bundled background worker beyond the opt-in APScheduler in the backend process; for multi-worker deployments use an external cron hitting the escalation hook or a single scheduler instance.
