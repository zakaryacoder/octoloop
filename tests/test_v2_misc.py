"""V2 misc tests: analytics filter-at-SQL + total-after-filter + pagination metadata,
escalation idempotency + multi-level + history + never-auto-close,
AI disclaimer + no-close + query-dashboard, CORS no-wildcard-by-default, security headers."""
from datetime import date, timedelta
from tests.test_patients import _patient_payload


def _make_overdue_case(client, headers, mrn):
    pid = client.post("/api/v1/patients", json=_patient_payload(mrn), headers=headers).json()["id"]
    past = (date.today() - timedelta(days=10)).isoformat()
    case = client.post("/api/v1/cases", json={"patient_id": pid, "priority": "HIGH",
                                              "due_date": past, "next_action": "x"}, headers=headers).json()
    return case


def test_cases_filters_at_sql_total_after_filter(client, auth_headers):
    # Create several cases with known statuses.
    pid = client.post("/api/v1/patients", json=_patient_payload("MRN-FILT-1"), headers=auth_headers).json()["id"]
    for _ in range(3):
        client.post("/api/v1/cases", json={"patient_id": pid, "priority": "HIGH", "next_action": "x"}, headers=auth_headers)
    r_all = client.get("/api/v1/cases?page_size=100", headers=auth_headers).json()
    r_high = client.get("/api/v1/cases?priority=HIGH&page_size=100", headers=auth_headers).json()
    # total after filter <= total unfiltered.
    assert r_high["total"] <= r_all["total"]
    assert r_high["total"] == len(r_high["items"])
    # Consistent pagination metadata.
    for body in [r_all, r_high]:
        assert "pages" in body
        assert body["page"] >= 1
        assert body["page_size"] >= 1


def test_overdue_only_filter_at_sql_before_pagination(client, auth_headers):
    _make_overdue_case(client, auth_headers, "MRN-OD-SQL-1")
    r = client.get("/api/v1/cases?overdue_only=true&page_size=100", headers=auth_headers).json()
    assert r["total"] >= 1
    assert all(item["overdue"] is True for item in r["items"])
    # total matches item count (not the pre-filter count).
    assert r["total"] == len(r["items"])


def test_escalation_idempotent_and_never_closes(client, auth_headers):
    case = _make_overdue_case(client, auth_headers, "MRN-ESC-1")
    # Run escalation twice (lazy run inside GET /cases).
    client.get("/api/v1/cases", headers=auth_headers)
    client.get("/api/v1/cases", headers=auth_headers)
    # Case must NOT be auto-closed.
    c = client.get(f"/api/v1/cases/{case['id']}", headers=auth_headers).json()
    assert c["status"] != "CLOSED"
    # Escalation history endpoint works.
    hist = client.get(f"/api/v1/cases/{case['id']}/escalations", headers=auth_headers)
    assert hist.status_code == 200
    # Idempotency: no duplicate escalation logs for same (case, rule, level, day).
    logs = hist.json()
    keys = [(l["rule_id"], l["level"]) for l in logs]
    assert len(keys) == len(set(keys)), f"duplicate escalation logs: {keys}"


def test_escalation_multi_level_rules_exist(client, auth_headers):
    rules = client.get("/api/v1/escalation-rules", headers=auth_headers).json()
    levels = sorted(r["level"] for r in rules)
    assert levels == sorted(set(levels))
    assert set(levels) <= {1, 2, 3}


def test_ai_summarize_includes_disclaimer(client, auth_headers):
    pid = client.post("/api/v1/patients", json=_patient_payload("MRN-AI-V2"), headers=auth_headers).json()["id"]
    case = client.post("/api/v1/cases", json={"patient_id": pid, "priority": "MEDIUM", "next_action": "x"},
                       headers=auth_headers).json()
    r = client.post("/api/v1/ai/summarize-case", json={"case_id": case["id"]}, headers=auth_headers)
    assert r.status_code == 200
    assert "DISCLAIMER" in r.json()["summary"]


def test_ai_query_dashboard_returns_disclaimer(client, auth_headers):
    r = client.post("/api/v1/ai/query-dashboard", json={"question": "how many overdue cases?"}, headers=auth_headers)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["disclaimer"]
    assert body["routed_to"] in ("population", "dashboard", "escalation", "unknown")
    assert body["answer"]


def test_ai_never_closes_case(client, auth_headers):
    # Calling AI endpoints must never mutate case status to CLOSED.
    pid = client.post("/api/v1/patients", json=_patient_payload("MRN-AI-NOCLOSE"), headers=auth_headers).json()["id"]
    case = client.post("/api/v1/cases", json={"patient_id": pid, "priority": "MEDIUM", "next_action": "x"},
                       headers=auth_headers).json()
    client.post("/api/v1/ai/summarize-case", json={"case_id": case["id"]}, headers=auth_headers)
    client.get("/api/v1/ai/operational-insights", headers=auth_headers)
    client.post("/api/v1/ai/query-dashboard", json={"question": "overview"}, headers=auth_headers)
    c = client.get(f"/api/v1/cases/{case['id']}", headers=auth_headers).json()
    assert c["status"] != "CLOSED"


def test_cors_no_wildcard_by_default(client):
    # With default config (ALLOW_CORS_WILDCARD not set), no "*" in allow-origin.
    r = client.get("/health", headers={"Origin": "http://evil.example.com"})
    acao = r.headers.get("access-control-allow-origin", "")
    assert acao != "*"


def test_security_headers_present(client):
    r = client.get("/health")
    assert r.headers.get("x-content-type-options") == "nosniff"
    assert r.headers.get("x-frame-options") == "DENY"
    assert "content-security-policy" in r.headers
    assert "referrer-policy" in r.headers


def test_notification_preferences_roundtrip(client, auth_headers):
    r = client.get("/api/v1/notifications/preferences", headers=auth_headers)
    assert r.status_code == 200
    r2 = client.put("/api/v1/notifications/preferences",
                    json={"channel_enabled": {"SMS": False, "EMAIL": True, "PORTAL": True}},
                    headers=auth_headers)
    assert r2.status_code == 200
    assert r2.json()["channel_enabled"]["SMS"] is False
