def _patient_payload(mrn="MRN-TEST-001"):
    return {
        "mrn": mrn, "first_name": "Test", "last_name": "Patient",
        "date_of_birth": "1980-05-15", "gender": "F", "phone": "+1-555-0100",
        "email": "test.patient@example.com", "address": "123 Test St",
        "medical_history_summary": "None", "allergies": "None",
    }


def test_create_patient(client, auth_headers):
    r = client.post("/api/v1/patients", json=_patient_payload(), headers=auth_headers)
    assert r.status_code == 201
    assert r.json()["mrn"] == "MRN-TEST-001"
    assert r.json()["id"] > 0


def test_create_patient_validation_error(client, auth_headers):
    bad = _patient_payload()
    del bad["mrn"]
    r = client.post("/api/v1/patients", json=bad, headers=auth_headers)
    assert r.status_code == 422


def test_list_and_get_patient(client, auth_headers):
    client.post("/api/v1/patients", json=_patient_payload("MRN-LIST-1"), headers=auth_headers)
    client.post("/api/v1/patients", json=_patient_payload("MRN-LIST-2"), headers=auth_headers)
    r = client.get("/api/v1/patients?page=1&page_size=10", headers=auth_headers)
    assert r.status_code == 200
    body = r.json()
    assert body["total"] >= 2
    assert len(body["items"]) >= 2
    pid = body["items"][0]["id"]
    r2 = client.get(f"/api/v1/patients/{pid}", headers=auth_headers)
    assert r2.status_code == 200
    detail = r2.json()
    assert "screenings" in detail and "follow_up_cases" in detail
    assert "referrals" in detail and "appointments" in detail


def test_update_patient(client, auth_headers):
    pid = client.post("/api/v1/patients", json=_patient_payload("MRN-UPD-1"), headers=auth_headers).json()["id"]
    r = client.put(f"/api/v1/patients/{pid}", json={"phone": "+1-555-9999"}, headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["phone"] == "+1-555-9999"


def test_patient_requires_auth(client):
    assert client.get("/api/v1/patients").status_code == 401
