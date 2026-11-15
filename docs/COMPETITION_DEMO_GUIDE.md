# OCTOLOOP — Competition Demo Guide (Team OCTOPUS)

> Challenge: Population Health — Closing the Screening-to-Care Loop.

## 0. Before the demo (setup, < 5 min)
1. `scripts\reset_demo.bat` (or `python scripts/init_db.py`) — seeds 30 patients / 50 screenings / 20 follow-up cases / 10 referrals / 15 appointments.
2. `scripts\start_all.bat` → backend on :8000, frontend on :3000.
3. Open http://localhost:3000, log in as **admin / Admin@12345**.

## 1. Demo narrative (8–10 minutes)

### Act 1 — The problem (1 min)
Open the **Dashboard** (command center). Point at:
- **Open follow-up cases** and **Overdue cases** KPI cards (red).
- **Follow-up completion rate** and **Screening-to-care conversion rate** — the two numbers the jury cares about.
- Recent activity feed shows live case events.
Line: *"Every year, X% of abnormal screening results never reach care. OCTOLOOP makes sure no result falls through the cracks — every case has an owner, a status, a due date, and a documented closure."*

### Act 2 — Register a screening and watch the loop start (2 min)
1. Go to **Screenings** → **Register Screening** (pick patient, type = Breast Cancer).
2. **Record Result** → classification = **Abnormal**. Show the **Actionable** badge.
3. Explain: an abnormal result **auto-creates a follow-up case** (status *New result*) with a responsible clinician and due date — no manual ticket, no lost letter.
4. Open the new case from the toast/link.

### Act 3 — The core: closed-loop case journey (3 min) — CORE MODULE
On **Case detail** page:
- Header: case ID `FU-2026-NNNN`, priority, responsible staff, due date, **Overdue** flag if red.
- **Interactive journey timeline**: walk through the 10 statuses — New result → Awaiting review → Patient notification pending → Patient notified → Awaiting confirmation → Referral pending → Appointment pending → Consultation completed → Treatment/surveillance → Closed. Each node is a real `case_event` with timestamp + actor.
- Use **Advance status** to move the case; show events append to the timeline.
- **Send patient notification** (Notification Center) — writes NOTIFICATION_SENT event, updates last contact.
- **Create referral** → accept it → **Schedule appointment** → mark **Completed/attended** — show the case auto-advances to *Consultation completed*.
- **AI summary panel**: operational summary, missing workflow steps, suggested next admin actions, and the mandatory disclaimer (*operational only; clinical decisions require authorized human oversight*).
- **Close case** with closure reason — only a human can close.

### Act 4 — Escalation & notifications (1.5 min)
- **Overdue cases** filter on /cases → red badges. Show an overdue case with an **ESCALATION** event in its timeline and a staff notification in **Notification Center** (escalation rules configurable in Admin).
- Admin → **Escalation rules** → show configurable trigger (e.g. overdue > 3 days → notify head of service).

### Act 5 — Analytics (1.5 min)
- **Analytics** page: screening volume trend, abnormal rate, follow-up completion rate, avg days screening→notification, avg days screening→consultation, overdue rate, referral completion, lost-to-follow-up. Every chart labeled *Illustrative simulated data*.
- Line: *"This is what a health system gets: a measurable loop, not a black box."*

### Act 6 — Security & admin (1 min)
- Admin → **Audit logs** (every action traceable), **Users & roles** (RBAC: admin/clinician/nurse/coordinator/viewer).
- Log out, log in as **coordinator.lee / Coord@12345** to show role-scoped view.
- Mention: bcrypt password hashing, JWT, Pydantic/Zod validation, audit trails, no secrets committed.

## 2. Demo gotchas
- If backend not seeded, KPIs show 0 → run `reset_demo.bat`.
- Use Chrome/Edge. Screen: 1440px wide for best command-center layout; responsive down to mobile.
- Have the screenshots in `screenshots/` ready as backup if network/port fails.

## 3. Key talking points for the jury
- **Closed-loop by design**: 10-state workflow, every case must end with a documented closure.
- **Owner + due date + escalation**: nothing is "pending" forever.
- **AI guardrails**: operational assistance only, never diagnoses/prescribes/closes cases.
- **Real stack, real data, real tests**: FastAPI + Next.js + PostgreSQL-ready, pytest suite, production frontend build.
