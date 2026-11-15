# OCTOLOOP — Commercial Viability & Path to Pilot

> Everything marked **[TO FILL]** must be completed with real, sourced information. Nothing in
> this document is a measured result. Figures are assumptions until validated.

## 1. Problem and value (measurable)
Abnormal screening results can be lost between result, notification, referral and consultation.
Value is expressed in metrics the system already computes:
- time from screening to patient notification;
- time from screening to consultation;
- referral completion rate;
- lost-to-follow-up rate and overdue-case rate.
Baseline values: **[TO FILL: real baseline from a clinic or published source, with citation]**.

## 2. Buyers and users
| Role | Examples (to validate) |
|---|---|
| Buyer / payer | health authority, hospital network, primary-care network, screening programme |
| Daily users | nurses, follow-up coordinators, clinicians |
| Beneficiaries | patients (portal in EN/FR/AR) |
Validation of buyer interest: **[TO FILL: interviews with at least 2–3 health professionals]**.

## 3. Business model options (to choose and test)
1. Per-site subscription (software + support).
2. Per-screened-population pricing for programmes.
3. Implementation / integration fee plus annual support.

## 4. Cost drivers (to quantify)
Hosting (backend + PostgreSQL), messaging (SMS/e-mail), support and onboarding, security/compliance work.
Unit economics: **[TO FILL: simple table with editable assumptions]**.

## 5. 90-day pilot plan (one primary-care site)
| Period | Scope |
|---|---|
| Days 0–15 | Choose site and champion nurse; agree scope (1–2 screening types), consent and data-protection steps |
| Days 15–45 | Configure users/roles and escalation rules; connect to the site's existing records via export/FHIR-style files; staff training |
| Days 45–90 | Run live follow-up; weekly review of overdue cases; collect metrics and staff feedback |

Success metrics (set targets with the site): notification delay, referral completion, lost-to-follow-up,
staff time saved, user satisfaction. Go/no-go: **[TO FILL: thresholds agreed with the site]**.

## 6. Risks and mitigations
| Risk | Mitigation |
|---|---|
| Staff adoption | champion nurse, short training, minimal data entry |
| Data protection | consent, role-based access, audit log, local hosting option |
| Integration with existing systems | start with import/export, FHIR-style mapping later |
| Notification delivery | real provider with honest QUEUED/SENT/FAILED status |

## 7. Regulatory notes (verify with a qualified professional)
The current scope is workflow coordination (no diagnosis, no clinical decision-making). If functionality
changes to clinical decision support, regulatory classification may change.
**[TO FILL: confirmation by a regulator or lawyer in the target country]**

## 8. Alternatives and competitors
**[TO FILL: verified list of existing patient-tracking / care-coordination tools and how OCTOLOOP differs]**
