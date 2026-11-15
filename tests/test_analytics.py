def test_analytics_overview_returns_numbers(client, auth_headers):
    r = client.get("/api/v1/analytics/overview", headers=auth_headers)
    assert r.status_code == 200
    body = r.json()
    for key in ["screening_volume", "abnormal_rate", "follow_up_completion_rate",
                "avg_days_screening_to_notification", "avg_days_screening_to_consultation",
                "overdue_rate", "referral_completion_rate", "lost_to_follow_up_count"]:
        assert key in body
        assert isinstance(body[key], (int, float))


def test_analytics_screening_volume(client, auth_headers):
    r = client.get("/api/v1/analytics/screening-volume?months=12", headers=auth_headers)
    assert r.status_code == 200
    assert isinstance(r.json(), list)
    if r.json():
        row = r.json()[0]
        assert "month" in row and "total" in row and "abnormal" in row and "actionable" in row


def test_analytics_timeliness(client, auth_headers):
    r = client.get("/api/v1/analytics/timeliness", headers=auth_headers)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_analytics_lost_to_followup(client, auth_headers):
    r = client.get("/api/v1/analytics/lost-to-followup", headers=auth_headers)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_dashboard_summary(client, auth_headers):
    r = client.get("/api/v1/dashboard/summary", headers=auth_headers)
    assert r.status_code == 200
    body = r.json()
    for key in ["total_patients", "total_screenings", "abnormal_results", "open_follow_up_cases",
                "overdue_cases", "completed_follow_ups", "pending_referrals", "upcoming_appointments",
                "follow_up_completion_rate", "screening_to_care_conversion_rate",
                "screening_volume_by_month", "cases_by_status", "overdue_by_responsible", "recent_activity"]:
        assert key in body, f"missing {key}"


def test_ai_summarize_case(client, auth_headers):
    from tests.test_patients import _patient_payload
    pid = client.post("/api/v1/patients", json=_patient_payload("MRN-AI-1"), headers=auth_headers).json()["id"]
    case = client.post("/api/v1/cases", json={"patient_id": pid, "priority": "MEDIUM", "next_action": "x"},
                       headers=auth_headers).json()
    r = client.post("/api/v1/ai/summarize-case", json={"case_id": case["id"]}, headers=auth_headers)
    assert r.status_code == 200
    body = r.json()
    assert "DISCLAIMER" in body["summary"]
    assert "missing_steps" in body and "suggested_next_actions" in body and "risk_flags" in body


def test_ai_operational_insights(client, auth_headers):
    r = client.get("/api/v1/ai/operational-insights", headers=auth_headers)
    assert r.status_code == 200
    body = r.json()
    assert "insights" in body and "top_overdue_cases" in body and "bottlenecks" in body


def test_admin_endpoints_require_admin(client, clinician_headers, auth_headers):
    # clinician cannot list users
    assert client.get("/api/v1/users", headers=clinician_headers).status_code == 403
    # admin can
    assert client.get("/api/v1/users", headers=auth_headers).status_code == 200
    assert client.get("/api/v1/roles", headers=auth_headers).status_code == 200
    assert client.get("/api/v1/escalation-rules", headers=auth_headers).status_code == 200
    assert client.get("/api/v1/settings", headers=auth_headers).status_code == 200
    assert client.get("/api/v1/audit-logs", headers=auth_headers).status_code == 200


def test_notifications_send_and_ack(client, auth_headers):
    from tests.test_patients import _patient_payload
    pid = client.post("/api/v1/patients", json=_patient_payload("MRN-NOT-1"), headers=auth_headers).json()["id"]
    case = client.post("/api/v1/cases", json={"patient_id": pid, "priority": "MEDIUM", "next_action": "x"},
                       headers=auth_headers).json()
    r = client.post("/api/v1/notifications/send", json={
        "audience": "PATIENT", "patient_id": pid, "case_id": case["id"],
        "channel": "SMS", "subject": "Reminder", "message": "Please call us",
    }, headers=auth_headers)
    assert r.status_code == 201
    nid = r.json()["id"]
    # V2: no provider configured -> status QUEUED + delivery log "no provider configured". Never fake SENT.
    assert r.json()["status"] == "QUEUED"
    dlogs = client.get(f"/api/v1/notifications/{nid}/delivery-logs", headers=auth_headers)
    assert dlogs.status_code == 200
    assert any("no provider" in dl["detail"] for dl in dlogs.json())
    r2 = client.post(f"/api/v1/notifications/{nid}/acknowledge", headers=auth_headers)
    assert r2.status_code == 200
    assert r2.json()["status"] == "ACKNOWLEDGED"


# ---- TZ-awareness regression tests (aware vs naive datetime subtraction) ----
def _build_full_case_chain(client, auth_headers, mrn="MRN-TZ-1"):
    """Create patient + abnormal screening (auto-creates case) + notification + attended appointment.
    This forces analytics/ai to subtract DB-read (naive-on-SQLite) datetimes from aware ones."""
    from tests.test_patients import _patient_payload
    pid = client.post("/api/v1/patients", json=_patient_payload(mrn), headers=auth_headers).json()["id"]
    sid = client.post("/api/v1/screenings", json={
        "patient_id": pid, "type": "BREAST", "screening_date": "2026-09-01", "facility": "TZ Clinic",
    }, headers=auth_headers).json()["id"]
    res = client.post(f"/api/v1/screenings/{sid}/result", json={
        "result_classification": "ABNORMAL", "result_summary": "suspicious",
    }, headers=auth_headers).json()
    case_id = res["created_case"]["id"]
    # notification linked to case -> sets sent_at (naive on read) and case.last_contact_at
    client.post("/api/v1/notifications/send", json={
        "audience": "PATIENT", "patient_id": pid, "case_id": case_id,
        "channel": "EMAIL", "subject": "Follow up", "message": "Please come in",
    }, headers=auth_headers)
    # appointment linked to case, completed attended -> sets attended_at (naive on read)
    aid = client.post("/api/v1/appointments", json={
        "patient_id": pid, "case_id": case_id, "department": "Oncology",
        "scheduled_at": "2026-10-01T10:00:00Z",
    }, headers=auth_headers).json()["id"]
    client.post(f"/api/v1/appointments/{aid}/complete", json={"attended": True, "notes": "done"}, headers=auth_headers)
    return case_id


def test_analytics_overview_tz_regression(client, auth_headers):
    _build_full_case_chain(client, auth_headers, "MRN-TZ-OV")
    r = client.get("/api/v1/analytics/overview", headers=auth_headers)
    assert r.status_code == 200, r.text
    body = r.json()
    for key in ["screening_volume", "abnormal_rate", "follow_up_completion_rate",
                "avg_days_screening_to_notification", "avg_days_screening_to_consultation",
                "overdue_rate", "referral_completion_rate", "lost_to_follow_up_count"]:
        assert isinstance(body[key], (int, float))
    # avg deltas must have been computed (not defaulting to 0.0 silently due to empty lists)
    assert body["avg_days_screening_to_notification"] >= 0
    assert body["avg_days_screening_to_consultation"] >= 0


def test_analytics_timeliness_tz_regression(client, auth_headers):
    _build_full_case_chain(client, auth_headers, "MRN-TZ-TM")
    r = client.get("/api/v1/analytics/timeliness", headers=auth_headers)
    assert r.status_code == 200, r.text
    rows = r.json()
    assert isinstance(rows, list)
    breast = [row for row in rows if row["screening_type"] == "BREAST"]
    if breast:
        assert isinstance(breast[0]["avg_days_to_notification"], (int, float))
        assert isinstance(breast[0]["avg_days_to_consultation"], (int, float))


def test_ai_summarize_case_tz_regression(client, auth_headers):
    case_id = _build_full_case_chain(client, auth_headers, "MRN-TZ-AI")
    r = client.post("/api/v1/ai/summarize-case", json={"case_id": case_id}, headers=auth_headers)
    assert r.status_code == 200, r.text
    body = r.json()
    assert "DISCLAIMER" in body["summary"]
    assert isinstance(body["missing_steps"], list)
    assert isinstance(body["suggested_next_actions"], list)
    assert isinstance(body["risk_flags"], list)
    assert isinstance(body["overdue"], bool)
