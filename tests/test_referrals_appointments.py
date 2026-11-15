from tests.test_patients import _patient_payload


def _patient(client, auth_headers, mrn):
    return client.post("/api/v1/patients", json=_patient_payload(mrn), headers=auth_headers).json()["id"]


def _case(client, auth_headers, pid):
    return client.post("/api/v1/cases", json={"patient_id": pid, "priority": "MEDIUM", "next_action": "x"},
                       headers=auth_headers).json()


def test_referral_lifecycle_accept_advances_case(client, auth_headers):
    pid = _patient(client, auth_headers, "MRN-REF-1")
    case = _case(client, auth_headers, pid)
    # advance case to REFERRAL_PENDING so accept can move it forward
    for st in ["AWAITING_REVIEW", "PATIENT_NOTIFICATION_PENDING", "PATIENT_NOTIFIED", "AWAITING_CONFIRMATION", "REFERRAL_PENDING"]:
        client.post(f"/api/v1/cases/{case['id']}/advance", json={"to_status": st, "note": "step"}, headers=auth_headers)
    r = client.post("/api/v1/referrals", json={
        "patient_id": pid, "case_id": case["id"], "to_department": "Oncology", "reason": "Abnormal result",
    }, headers=auth_headers)
    assert r.status_code == 201
    rid = r.json()["id"]
    assert r.json()["status"] == "DRAFT"
    assert client.post(f"/api/v1/referrals/{rid}/send", headers=auth_headers).status_code == 200
    r_acc = client.post(f"/api/v1/referrals/{rid}/accept", json={"notes": "Accepted"}, headers=auth_headers)
    assert r_acc.status_code == 200
    assert r_acc.json()["status"] == "ACCEPTED"
    case_after = client.get(f"/api/v1/cases/{case['id']}", headers=auth_headers).json()
    assert case_after["status"] == "APPOINTMENT_PENDING"


def test_referral_reject(client, auth_headers):
    pid = _patient(client, auth_headers, "MRN-REF-REJ")
    case = _case(client, auth_headers, pid)
    rid = client.post("/api/v1/referrals", json={
        "patient_id": pid, "case_id": case["id"], "to_department": "Cardiology", "reason": "x",
    }, headers=auth_headers).json()["id"]
    client.post(f"/api/v1/referrals/{rid}/send", headers=auth_headers)
    r = client.post(f"/api/v1/referrals/{rid}/reject", json={"reason": "Not indicated"}, headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["status"] == "REJECTED"


def test_appointment_complete_attended_advances_case(client, auth_headers):
    pid = _patient(client, auth_headers, "MRN-APT-1")
    case = _case(client, auth_headers, pid)
    aid = client.post("/api/v1/appointments", json={
        "patient_id": pid, "case_id": case["id"], "department": "Oncology",
        "scheduled_at": "2026-11-20T10:00:00Z",
    }, headers=auth_headers).json()["id"]
    r = client.post(f"/api/v1/appointments/{aid}/complete", json={"attended": True, "notes": "Consult done"}, headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["status"] == "COMPLETED"
    case_after = client.get(f"/api/v1/cases/{case['id']}", headers=auth_headers).json()
    assert case_after["status"] == "CONSULTATION_COMPLETED"


def test_appointment_no_show(client, auth_headers):
    pid = _patient(client, auth_headers, "MRN-APT-NS")
    case = _case(client, auth_headers, pid)
    aid = client.post("/api/v1/appointments", json={
        "patient_id": pid, "case_id": case["id"], "department": "Oncology",
        "scheduled_at": "2026-11-21T10:00:00Z",
    }, headers=auth_headers).json()["id"]
    r = client.post(f"/api/v1/appointments/{aid}/complete", json={"attended": False}, headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["status"] == "NO_SHOW"


def test_appointment_cancel_and_reschedule(client, auth_headers):
    pid = _patient(client, auth_headers, "MRN-APT-CXL")
    case = _case(client, auth_headers, pid)
    aid = client.post("/api/v1/appointments", json={
        "patient_id": pid, "case_id": case["id"], "department": "Oncology",
        "scheduled_at": "2026-11-22T10:00:00Z",
    }, headers=auth_headers).json()["id"]
    r = client.post(f"/api/v1/appointments/{aid}/cancel", json={"reason": "Patient request"}, headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["status"] == "CANCELLED"
    # reschedule a different appointment
    aid2 = client.post("/api/v1/appointments", json={
        "patient_id": pid, "department": "Oncology", "scheduled_at": "2026-11-23T10:00:00Z",
    }, headers=auth_headers).json()["id"]
    r2 = client.put(f"/api/v1/appointments/{aid2}", json={"scheduled_at": "2026-11-25T14:00:00Z"}, headers=auth_headers)
    assert r2.status_code == 200
    assert r2.json()["status"] == "RESCHEDULED"
