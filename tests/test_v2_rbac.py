"""V2 Phase 2 RBAC tests: permission strings, 401/403, case-close restriction,
user-mgmt restriction, viewer read-only, roles endpoint returns matrix."""
from tests.test_patients import _patient_payload


def _make_case(client, headers, mrn="MRN-RBAC-1"):
    pid = client.post("/api/v1/patients", json=_patient_payload(mrn), headers=headers).json()["id"]
    case = client.post("/api/v1/cases", json={"patient_id": pid, "priority": "MEDIUM", "next_action": "x"},
                       headers=headers).json()
    return pid, case


def test_unauthenticated_returns_401(client):
    assert client.get("/api/v1/cases").status_code == 401
    assert client.get("/api/v1/patients").status_code == 401
    assert client.get("/api/v1/users").status_code == 401


def test_nurse_cannot_close_case_403(client, nurse_headers, auth_headers):
    _, case = _make_case(client, auth_headers, "MRN-RBAC-CLOSE")
    r = client.post(f"/api/v1/cases/{case['id']}/close",
                    json={"closure_reason": "RESOLVED", "note": "x"}, headers=nurse_headers)
    assert r.status_code == 403


def test_viewer_cannot_close_case_403(client, viewer_headers, auth_headers):
    _, case = _make_case(client, auth_headers, "MRN-RBAC-CLOSE2")
    r = client.post(f"/api/v1/cases/{case['id']}/close",
                    json={"closure_reason": "RESOLVED", "note": "x"}, headers=viewer_headers)
    assert r.status_code == 403


def test_clinician_can_close_case_200(client, clinician_headers, auth_headers):
    _, case = _make_case(client, auth_headers, "MRN-RBAC-CLOSE3")
    r = client.post(f"/api/v1/cases/{case['id']}/close",
                    json={"closure_reason": "RESOLVED", "note": "ok"}, headers=clinician_headers)
    assert r.status_code == 200
    assert r.json()["status"] == "CLOSED"


def test_coordinator_can_close_case_200(client, auth_headers):
    _, case = _make_case(client, auth_headers, "MRN-RBAC-CLOSE4")
    coord = client.post("/api/v1/auth/login", json={"username": "coordinator.lee", "password": "Coord@12345"}).json()
    coord_h = {"Authorization": f"Bearer {coord['access_token']}"}
    r = client.post(f"/api/v1/cases/{case['id']}/close",
                    json={"closure_reason": "RESOLVED", "note": "ok"}, headers=coord_h)
    assert r.status_code == 200


def test_user_management_admin_only(client, clinician_headers, nurse_headers, auth_headers):
    # clinician / nurse cannot list users, create users, or modify settings/rules.
    assert client.get("/api/v1/users", headers=clinician_headers).status_code == 403
    assert client.get("/api/v1/users", headers=nurse_headers).status_code == 403
    assert client.post("/api/v1/users", json={"username": "x", "password": "Strong@123", "role": "nurse"},
                       headers=clinician_headers).status_code == 403
    assert client.put("/api/v1/settings", json={"k": "v"}, headers=clinician_headers).status_code == 403
    assert client.post("/api/v1/escalation-rules",
                       json={"name": "r", "level": 1, "trigger_overdue_days": 1, "escalate_to_role": "nurse"},
                       headers=clinician_headers).status_code == 403
    # admin can.
    assert client.get("/api/v1/users", headers=auth_headers).status_code == 200


def test_viewer_read_only_on_mutations(client, viewer_headers, auth_headers):
    pid = client.post("/api/v1/patients", json=_patient_payload("MRN-RBAC-VIEW"), headers=auth_headers).json()["id"]
    assert client.post("/api/v1/patients", json=_patient_payload("MRN-RBAC-VIEW2"), headers=viewer_headers).status_code == 403
    assert client.put(f"/api/v1/patients/{pid}", json={"first_name": "Hacked"}, headers=viewer_headers).status_code == 403
    assert client.post("/api/v1/cases", json={"patient_id": pid, "priority": "LOW", "next_action": "x"},
                       headers=viewer_headers).status_code == 403
    # viewer CAN read.
    assert client.get("/api/v1/patients", headers=viewer_headers).status_code == 200
    assert client.get("/api/v1/cases", headers=viewer_headers).status_code == 200


def test_nurse_cannot_record_screening_result(client, nurse_headers, auth_headers):
    pid = client.post("/api/v1/patients", json=_patient_payload("MRN-RBAC-REC"), headers=auth_headers).json()["id"]
    sid = client.post("/api/v1/screenings", json={"patient_id": pid, "type": "BREAST", "screening_date": "2026-10-01"},
                      headers=auth_headers).json()["id"]
    r = client.post(f"/api/v1/screenings/{sid}/result",
                    json={"result_classification": "ABNORMAL", "result_summary": "x"}, headers=nurse_headers)
    assert r.status_code == 403


def test_roles_endpoint_returns_permission_matrix(client, auth_headers):
    r = client.get("/api/v1/roles", headers=auth_headers)
    assert r.status_code == 200
    roles = {role["name"]: set(role["permissions"]) for role in r.json()}
    assert "cases:close" in roles["admin"]
    assert "cases:close" in roles["clinician"]
    assert "cases:close" in roles["coordinator"]
    assert "cases:close" not in roles["nurse"]
    assert "cases:close" not in roles["viewer"]
    assert "users:manage" in roles["admin"]
    assert "users:manage" not in roles["clinician"]
    assert "portal:self" in roles["patient"]
    assert len(roles["patient"]) == 1
    # viewer has only read perms.
    viewer_perms = roles["viewer"]
    assert all(p.endswith(":read") for p in viewer_perms)


def test_password_policy_enforced_on_create(client, auth_headers):
    r = client.post("/api/v1/users", json={"username": "weakpass", "password": "short", "role": "nurse"},
                    headers=auth_headers)
    assert r.status_code == 422
    r2 = client.post("/api/v1/users", json={"username": "weakpass2", "password": "alllowercase1!", "role": "nurse"},
                     headers=auth_headers)
    assert r2.status_code == 422
    r3 = client.post("/api/v1/users", json={"username": "stronguser", "password": "Strong@12345", "role": "nurse"},
                     headers=auth_headers)
    assert r3.status_code == 201
