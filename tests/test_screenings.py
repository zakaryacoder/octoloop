from tests.test_patients import _patient_payload


def _create_patient(client, auth_headers, mrn="MRN-SCR-1"):
    return client.post("/api/v1/patients", json=_patient_payload(mrn), headers=auth_headers).json()["id"]


def test_create_screening(client, auth_headers):
    pid = _create_patient(client, auth_headers)
    r = client.post("/api/v1/screenings", json={
        "patient_id": pid, "type": "BREAST", "screening_date": "2026-10-01", "facility": "Test Clinic",
    }, headers=auth_headers)
    assert r.status_code == 201
    assert r.json()["type"] == "BREAST"
    assert r.json()["actionable"] is False


def test_record_abnormal_result_auto_creates_case(client, auth_headers):
    pid = _create_patient(client, auth_headers, "MRN-SCR-ABN")
    sid = client.post("/api/v1/screenings", json={
        "patient_id": pid, "type": "COLORECTAL", "screening_date": "2026-10-05",
    }, headers=auth_headers).json()["id"]
    r = client.post(f"/api/v1/screenings/{sid}/result", json={
        "result_classification": "ABNORMAL", "result_summary": "Polyp found",
    }, headers=auth_headers)
    assert r.status_code == 200
    body = r.json()
    assert body["screening"]["result_classification"] == "ABNORMAL"
    assert body["created_case"] is not None
    assert body["created_case"]["status"] == "NEW_RESULT"
    assert body["created_case"]["priority"] == "HIGH"
    assert body["created_case"]["case_ref"].startswith("FU-")


def test_record_normal_result_no_case(client, auth_headers):
    pid = _create_patient(client, auth_headers, "MRN-SCR-NORM")
    sid = client.post("/api/v1/screenings", json={
        "patient_id": pid, "type": "DIABETES", "screening_date": "2026-10-10",
    }, headers=auth_headers).json()["id"]
    r = client.post(f"/api/v1/screenings/{sid}/result", json={
        "result_classification": "NORMAL", "result_summary": "OK",
    }, headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["created_case"] is None


def test_assign_screening(client, auth_headers, clinician_headers):
    pid = _create_patient(client, auth_headers, "MRN-SCR-ASN")
    sid = client.post("/api/v1/screenings", json={
        "patient_id": pid, "type": "CERVICAL", "screening_date": "2026-10-12",
    }, headers=auth_headers).json()["id"]
    clinician_id = client.get("/api/v1/auth/me", headers=clinician_headers).json()["id"]
    r = client.post(f"/api/v1/screenings/{sid}/assign", json={"clinician_id": clinician_id}, headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["assigned_clinician_id"] == clinician_id
