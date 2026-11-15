# OCTOLOOP API Deviations from Frozen Contract

The backend implements the frozen contract in `docs/API_CONTRACT.md`. The following are intentional, documented minor deviations (additive or type-clarifying); none change a path, status code, or required response field.

1. **`POST /screenings/{id}/result` — `recorded_by` type.** The contract lists `recorded_by` in the request body without specifying type. The backend accepts an **integer user id** (FK to `users.id`); it is optional and defaults to the authenticated user's id. A string name would 422.
2. **`page_size` parameter added to list endpoints.** Contract specifies `page` for several list endpoints; the backend additionally accepts `page_size` (default 20, max 100). Omitting it behaves exactly as contract expects.
3. **`GET /cases/overdue` returns a JSON array** (not a paginated object), matching the contract wording "list of overdue cases (same shape)".
4. **`PUT /settings` body shape.** Contract says "key/value system settings". The backend accepts a JSON object `{ "<key>": "<value>", ... }` and upserts each key; `GET /settings` returns the same object shape.
5. **`POST /referrals/{id}/accept` and `POST /appointments/{id}/complete` case-advance behavior.** Per contract, accept advances the linked case "toward APPOINTMENT_PENDING" and complete (attended) advances to CONSULTATION_COMPLETED. The backend performs this advance unconditionally for any non-closed linked case (writes STATUS_CHANGE + domain event), rather than only from a subset of statuses.
6. **CORS.** `allow_origins` includes `*` for the portable demo in addition to `CORS_ORIGINS` from env. Production deployments should set `CORS_ORIGINS` and remove the wildcard. Not a contract endpoint change.
7. **Escalation target user.** When an escalation rule's `escalate_to_role` has no active user, the backend falls back to the first active `coordinator`; if none exists, no STAFF notification is created (the escalation_log + ESCALATION case event are still created).
8. **`GET /dashboard/summary` `screening_volume_by_month`** returns the most recent 6 months present in data (contract does not fix a count).

No paths, enums, or required response fields were changed.
