from datetime import date, timedelta
from tests.test_patients import _patient_payload


def _create_patient(client, auth_headers, mrn="MRN-CASE-1"):
    return client.post("/api/v1/patients", json=_patient_payload(mrn), headers=auth_headers).json()["id"]


def _create_case(client, auth_headers, pid, due_date=None):
    payload = {"patient_id": pid, "priority": "MEDIUM", "next_action": "Review"}
    if due_date:
        payload["due_date"] = due_date
    r = client.post("/api/v1/cases", json=payload, headers=auth_headers)
    assert r.status_code == 201, r.text
    return r.json()


def test_create_and_get_case(client, auth_headers):
    pid = _create_patient(client, auth_headers)
    case = _create_case(client, auth_headers, pid)
    assert case["status"] == "NEW_RESULT"
    assert case["case_ref"].startswith("FU-")
    r = client.get(f"/api/v1/cases/{case['id']}", headers=auth_headers)
    assert r.status_code == 200
    detail = r.json()
    assert detail["events"]  # CASE_CREATED event
    assert "referrals" in detail and "appointments" in detail
    assert detail["patient"] is not None


def test_update_case(client, auth_headers):
    pid = _create_patient(client, auth_headers, "MRN-CASE-UPD")
    case = _create_case(client, auth_headers, pid)
    r = client.put(f"/api/v1/cases/{case['id']}", json={"next_action": "Call patient", "priority": "HIGH"}, headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["next_action"] == "Call patient"
    assert r.json()["priority"] == "HIGH"


def test_advance_valid_transition(client, auth_headers):
    pid = _create_patient(client, auth_headers, "MRN-CASE-ADV")
    case = _create_case(client, auth_headers, pid)
    r = client.post(f"/api/v1/cases/{case['id']}/advance", json={"to_status": "AWAITING_REVIEW"}, headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["status"] == "AWAITING_REVIEW"


def test_advance_skip_without_note_rejected(client, auth_headers, clinician_headers):
    pid = _create_patient(client, auth_headers, "MRN-CASE-SKIP")
    case = _create_case(client, auth_headers, pid)
    # non-admin (clinician) skipping from NEW_RESULT to PATIENT_NOTIFIED (2 steps) without note -> 400
    r = client.post(f"/api/v1/cases/{case['id']}/advance", json={"to_status": "PATIENT_NOTIFIED"}, headers=clinician_headers)
    assert r.status_code == 400


def test_advance_skip_with_note_allowed(client, auth_headers):
    pid = _create_patient(client, auth_headers, "MRN-CASE-SKIPN")
    case = _create_case(client, auth_headers, pid)
    r = client.post(f"/api/v1/cases/{case['id']}/advance",
                    json={"to_status": "PATIENT_NOTIFIED", "note": "Expedited per clinician"}, headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["status"] == "PATIENT_NOTIFIED"


def test_advance_backward_rejected(client, auth_headers):
    pid = _create_patient(client, auth_headers, "MRN-CASE-BACK")
    case = _create_case(client, auth_headers, pid)
    client.post(f"/api/v1/cases/{case['id']}/advance", json={"to_status": "AWAITING_REVIEW"}, headers=auth_headers)
    r = client.post(f"/api/v1/cases/{case['id']}/advance", json={"to_status": "NEW_RESULT"}, headers=auth_headers)
    assert r.status_code == 400


def test_close_case_requires_human_endpoint(client, auth_headers):
    pid = _create_patient(client, auth_headers, "MRN-CASE-CLOSE")
    case = _create_case(client, auth_headers, pid)
    r = client.post(f"/api/v1/cases/{case['id']}/close",
                    json={"closure_reason": "RESOLVED", "note": "All clear"}, headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["status"] == "CLOSED"
    # closing again fails
    r2 = client.post(f"/api/v1/cases/{case['id']}/close",
                     json={"closure_reason": "RESOLVED", "note": "x"}, headers=auth_headers)
    assert r2.status_code == 400
    # advance on closed fails
    r3 = client.post(f"/api/v1/cases/{case['id']}/advance", json={"to_status": "AWAITING_REVIEW"}, headers=auth_headers)
    assert r3.status_code == 400


def test_add_case_event(client, auth_headers):
    pid = _create_patient(client, auth_headers, "MRN-CASE-EVT")
    case = _create_case(client, auth_headers, pid)
    r = client.post(f"/api/v1/cases/{case['id']}/events",
                    json={"event_type": "PATIENT_CONTACT", "note": "Called patient", "contact_outcome": "Reached"},
                    headers=auth_headers)
    assert r.status_code == 201
    assert r.json()["event_type"] == "PATIENT_CONTACT"


def test_overdue_cases_list(client, auth_headers):
    pid = _create_patient(client, auth_headers, "MRN-CASE-OD")
    past = (date.today() - timedelta(days=5)).isoformat()
    _create_case(client, auth_headers, pid, due_date=past)
    r = client.get("/api/v1/cases/overdue", headers=auth_headers)
    assert r.status_code == 200
    assert any(c["overdue"] for c in r.json())
