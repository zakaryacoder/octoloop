# OCTOLOOP — Responsible AI, Safety & Data Governance

## 1. Intended use
OCTOLOOP coordinates **follow-up after an abnormal screening result**: ownership, due dates,
notifications, referrals, appointments, escalation and documented closure.
The AI features are **operational helpers only**: summarise a case's history, flag overdue cases,
highlight missing workflow steps, suggest administrative next actions, answer dashboard questions.

## 2. Out of scope (never done by the system)
- No diagnosis, no prescribing, no treatment advice.
- No autonomous determination of clinical urgency; priority is set by humans.
- No automatic case closure: `POST /cases/{id}/close` needs an authenticated human with
  `cases:close` and a closure reason (nurse, viewer and patient roles are refused).
- Screening results are **not** diagnoses; abnormal/borderline results only trigger a follow-up task.

## 3. Human oversight points
| Step | Who decides |
|---|---|
| Recording and classifying a result | clinician (`screenings:record`) |
| Setting priority / responsible person | authorised staff |
| Escalation (L1/L2/L3) | rule-triggered, always visible in the case timeline, never closes a case |
| Case closure | human with `cases:close`, closure reason required |

## 4. AI design and failure modes
- Default path is **deterministic, offline and rule-based**; every response carries a fixed disclaimer.
- Optional LLM path (when configured) must minimise PHI, use a timeout and **fall back to the
  deterministic path**.
- Failure modes and mitigations: wrong or stale summary → disclaimer + link to the raw timeline;
  missed overdue case → idempotent escalation plus an external cron hook; LLM unavailable → fallback.
- Bias consideration: rules use workflow facts (dates, statuses), not demographic attributes.
  Fairness of follow-up times across groups should be reported in the evaluation (see TECHNICAL_DOCUMENTATION §6).

## 5. Data governance (current state)
- **Roles/permissions**: granular permission strings enforced on every endpoint (`docs/SECURITY.md`).
- **Patient isolation**: portal endpoints are scoped to `users.patient_id`; cross-access returns 403.
- **Auth**: 15-min access tokens, rotating refresh tokens with reuse detection, persistent lockout, rate limit.
- **Audit log** for authentication events and mutations; logs never contain secrets or PHI.
- **Population endpoints** are aggregated and anonymized (no patient identifiers).
- **Synthetic data only** in this repository.

## 6. Gaps to close before any real deployment (roadmap)
- Minimum group size (small-cell suppression) on population endpoints.
- Explicit consent capture at registration and a patient export/delete-my-data flow.
- Retention settings, encryption-at-rest configuration, and a data-protection impact assessment
  under the rules of the target country. **[TO FILL: applicable regulation and legal review]**
