# OCTOLOOP — Intelligent Screening Follow-up Platform

**Team OCTOPUS** · Challenge: Population Health — Closing the Screening-to-Care Loop

OCTOLOOP is a healthcare coordination platform that prevents patients from being lost between
screening and treatment. Every actionable screening result is tracked through a complete closed-loop
journey — **Screening → Result Review → Patient Notification → Acknowledgement → Confirmatory
Testing → Referral → Appointment → Consultation → Treatment/Surveillance → Documented Closure** —
with a responsible owner, a clear status, a due date, a full event history, and automatic escalation
when overdue.

> ⚠️ **Demo data only.** All patients, names, contact details and metrics in this repository are
> fictional and synthetic. Analytics figures are illustrative simulated data. This software is a
> competition prototype, not a medical device. The built-in AI assistance is **operational only** —
> it never diagnoses, prescribes, autonomously determines clinical urgency, makes clinical decisions,
> or closes cases. All clinical decisions require authorized human oversight.

---

## 1. Technology stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router) · React 18 · TypeScript · Tailwind CSS · shadcn/ui-style components · Lucide React · Recharts · React Hook Form · Zod |
| Backend | Python 3.12 · FastAPI · SQLAlchemy 2 · Pydantic · JWT (python-jose) · bcrypt (passlib) · Role-Based Access Control |
| Database | PostgreSQL (production target, via `DATABASE_URL`) · **SQLite portable-demo fallback** (default, zero-config) · Alembic migrations |
| Testing | pytest + FastAPI TestClient (41 tests) · `next build` production build |

## 2. Project structure

```
OCTOLOOP/
├── frontend/                 Next.js app (all 10 module pages, real API fetch, no static mocks)
│   ├── app/(app)/            dashboard, patients, screenings, cases, referrals, appointments,
│   │                         notifications, analytics, admin + login
│   ├── components/           ui primitives, StatusBadge, CaseTimeline, KpiCard, layout
│   └── lib/                  api.ts fetch wrapper, auth context, types, constants
├── backend/app/              FastAPI application
│   ├── api/                  11 routers (auth, dashboard, patients, screenings, cases, referrals,
│   │                         appointments, notifications, analytics, ai, admin)
│   ├── core/                 config, database, security (bcrypt+JWT), deps (RBAC, lockout)
│   ├── models/               15 SQLAlchemy tables (normalized, PKs/FKs/indexes/timestamps)
│   ├── schemas/              Pydantic enums + request/response models
│   └── services/             escalation engine, rule-based AI ops, demo seed, serializers
├── database/                 alembic.ini, alembic/ (initial migration), octoloop.db (seeded demo)
├── scripts/                  init_db.py, seed_demo.py, capture_screenshots.py,
│                              start_backend.bat, start_frontend.bat, start_all.bat, reset_demo.bat
├── tests/                    pytest suite (41 tests)
├── docs/                     API.md, API_CONTRACT.md (frozen), API_DEVIATIONS.md,
│                              DESIGN_TOKENS.md, COMPETITION_DEMO_GUIDE.md, PRESENTATION_5MIN.md
├── screenshots/              PNG captures of the running app
├── .env.example              copy to .env (never commit .env)
├── .gitignore
└── README.md
```

## 3. Quick start (Windows 11)

Prerequisites: Python 3.10+ and Node.js 18+ installed.

```bat
:: 1. Backend
cd backend
python -m venv .venv && .venv\Scripts\activate
pip install -r requirements.txt
cd ..
python scripts\init_db.py            :: creates database/octoloop.db + seeds demo data
scripts\start_backend.bat            :: uvicorn on http://localhost:8000  (API docs at /docs)

:: 2. Frontend (new terminal)
cd frontend
npm install
npm run dev                          :: http://localhost:3000

:: or start both at once:
scripts\start_all.bat
```

**Demo logins** (seeded):

| username | password | role |
|---|---|---|
| `admin` | `Admin@12345` | admin |
| `dr.smith` | `Clinician@123` | clinician |
| `nurse.jones` | `Nurse@12345` | nurse |
| `coordinator.lee` | `Coord@12345` | follow-up coordinator |
| `viewer.demo` | `Viewer@12345` | read-only viewer |

To reset the demo database at any time: `scripts\reset_demo.bat`.

## 4. Using PostgreSQL (production target)

Set in `.env`:
```
DATABASE_URL=postgresql+psycopg2://octoloop:octoloop@localhost:5432/octoloop
```
then `cd database && alembic upgrade head` and `python scripts/seed_demo.py`.
The default `sqlite:///...` fallback exists so the demo runs with zero external services; all models
and queries are DB-agnostic (date grouping is done in Python).

## 5. Modules (all functional against real API endpoints)

- **A. Authentication** — login/logout, bcrypt hashing, JWT bearer tokens, RBAC (5 roles),
  5-failure/5-minute lockout (429), audit log on auth events.
- **B. Dashboard** — command center: 10 KPI cards, screening-volume chart, cases-by-status,
  overdue-by-responsible, recent activity feed.
- **C. Patient management** — register/search/view patients, profile with tabs (details, screenings,
  follow-up cases, referrals, appointments).
- **D. Screening management** — breast/cervical/colorectal cancer, diabetes, hypertension, other;
  register, record result, classify; **abnormal/borderline results auto-create a follow-up case**.
- **E. Follow-up case management (core)** — 10-state workflow, case ref `FU-YYYY-NNNN`, priority,
  responsible staff, due date, last contact, next action; **interactive journey timeline** of every
  case event; overdue alerts + idempotent escalation; human-only case closure with closure reason.
- **F. Referral management** — create → send → accept/reject → complete, linked to cases.
- **G. Appointment management** — schedule, reschedule, cancel, mark attended/no-show/complete,
  linked to patients and cases; attended completion auto-advances the linked case.
- **H. Notification center** — patient + staff notifications, send/acknowledge, overdue/escalation
  alerts, full history (delivery simulated, no real SMS/email gateway).
- **I. Analytics** — screening volume, abnormal rate, follow-up completion, avg time
  screening→notification and →consultation, overdue rate, referral completion, lost-to-follow-up;
  all panels labelled *Illustrative simulated data*.
- **J. Settings & administration** — user management, roles/permissions, audit logs, configurable
  escalation rules, system settings.

## 6. AI-assisted operational features (guardrails enforced)

`POST /ai/summarize-case` and `GET /ai/operational-insights` are **deterministic, offline,
rule-based** operational helpers: summarize follow-up history, flag overdue cases, highlight missing
workflow steps, suggest administrative next actions. Every response carries a fixed disclaimer.
Enforced boundary: no endpoint ever diagnoses, prescribes, autonomously sets clinical urgency, makes
clinical decisions, or closes a case — `POST /cases/{id}/close` requires an authenticated human user
and a `closure_reason`.

## 7. Testing

```bash
# Backend (from repo root, uses a temp SQLite DB)
python -m pytest tests/ -q          # 41 passed

# Frontend
cd frontend && npm run build        # production build, exit 0 (13 routes)
```

## 8. API documentation

- Interactive auto-docs: `http://localhost:8000/docs` (OpenAPI/Swagger) and `/redoc`.
- Written reference: `docs/API.md`.
- Frozen contract + intentional minor deviations: `docs/API_CONTRACT.md`, `docs/API_DEVIATIONS.md`.

## 9. Known limitations (honest, current state)

1. **PostgreSQL is not runtime-verified.** It is supported through `DATABASE_URL` + Alembic and
   Docker Compose, but the full test-suite has so far only been run against SQLite.
2. **No real delivery gateway is bundled.** Notifications use a provider architecture and stay
   `QUEUED` (never falsely `SENT`) until a real SMTP/SMS provider is configured.
3. **Translation is broad but not 100%.** EN/FR/AR cover the navigation, enum labels, ~380 page phrases
   (`tx()` dictionaries), validation messages, dates/times/relative time. Still English: text built by
   template strings with variables (e.g. "Referral #12 → ..."), raw API error details, and
   backend-generated texts (AI summaries, timeline descriptions). `npm run check:i18n` keeps files in sync.
4. **Population metrics have no small-cell suppression yet.** Endpoints are aggregated and
   anonymized, but a minimum group size (k-anonymity style threshold) is on the roadmap.
5. **Synthetic data only.** All patients and analytics are fictional and illustrative; no
   clinical validation or pilot has been performed. This is not a medical device.
6. **Some UI gaps** remain (patient edit form, case priority/responsible editing in the UI;
   `GET /ai/operational-insights` is not surfaced). The new **Impact** page compares current data with a
   baseline the user must enter and source; nothing is pre-filled.
7. **Not compiled in the authoring environment.** The last changes were syntax-checked (TypeScript parser) but
   `npm run build` and `pytest` must be run once before submission.

> Previously listed limitations that V2 fixed: persistent lockout, explicit CORS origins,
> opt-in scheduler, honest notification statuses.

## 10. Competition materials

- `docs/COMPETITION_DEMO_GUIDE.md` — step-by-step 8-minute demo narrative.
- `docs/PRESENTATION_5MIN.md` — five-minute jury presentation script.
- `screenshots/` — PNG captures of the running application (`v1_before/` and `v2_after/`).

---

## V2 Upgrade (see docs/CHANGELOG.md for full list)
- **Security/RBAC**: granular permission strings enforced on every endpoint (401 unauth / 403 forbidden), 15-min access + rotating refresh tokens with revocation + reuse-family detection, persistent DB-backed login lockout + rate limiting, password policy, security headers + CSP, CORS explicit origins (wildcard behind `ALLOW_CORS_WILDCARD` dev flag), production secret check at startup. See `docs/SECURITY.md` (permission matrix).
- **Population Health Intelligence**: `/population/*` aggregated anonymized endpoints + `/population` dashboard + CSV export; operational (not clinical) risk labeling.
- **Intelligent escalation**: multi-level L1/L2/L3 rules, opt-in APScheduler + external cron hook, idempotent, never auto-closes.
- **AI ops upgrade**: deterministic fallback mandatory; optional LLM (PHI-minimized, timeout, fallback); `/ai/query-dashboard` NL queries; disclaimers on all responses.
- **Patient portal**: `/portal/*` endpoints with strict own-record isolation + frontend `/portal` section (demo: `patient.ross / Patient@12345`).
- **Multilingual**: EN/FR/AR with RTL Arabic; language selector, persisted preference.
- **Notifications**: provider architecture; `QUEUED` (never falsely `SENT`) without a real provider; delivery logs, retry, user preferences.
- **Docker**: `Dockerfile.backend`, `Dockerfile.frontend`, `docker-compose.yml` (PostgreSQL + migrate + backend + frontend) with health checks; `docs/DEPLOYMENT.md`.
- **DB**: indexes on hot columns, `DATABASE_URL` validation, Alembic V2 migration, SQLite dev preserved.
- **Tests**: 80 pytest passing (V1 41 + V2 39); frontend production build green (20 routes).
- Demo credentials unchanged (staff) + `patient.ross / Patient@12345` (portal).

## Health probes

`GET /health` (liveness) and `GET /ready` (readiness, checks the database; 503 if unavailable).

## Submission documents

- `docs/TECHNICAL_DOCUMENTATION.md` — architecture, AI components, security, evaluation, assumptions, limitations.
- `docs/RESPONSIBLE_AI.md` — intended use, human oversight, failure modes, data governance.
- `docs/COMMERCIAL_AND_PILOT.md` — buyers, value, cost drivers, 90-day pilot plan (items marked `[TO FILL]` need real data).
- `docs/DEMO_SCRIPT_3MIN.md` — one-patient-story demo script.
