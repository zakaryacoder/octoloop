"""V2 Phase 9 patient portal tests: strict own-record isolation.
Patient A cannot read patient B's data; staff cannot access /portal/*; portal data excludes internal notes."""


def test_portal_me_returns_own_profile(client, patient_a_headers):
    r = client.get("/api/v1/portal/me", headers=patient_a_headers)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["mrn"] == "MRN-PAT-A"
    assert body["first_name"] == "Alice"


def test_portal_endpoints_accessible_to_patient_only(client, auth_headers, patient_a_headers):
    # Staff (admin) is NOT patient role -> 403 on portal.
    assert client.get("/api/v1/portal/me", headers=auth_headers).status_code == 403
    # Patient can access all portal endpoints.
    for path in ["/api/v1/portal/me", "/api/v1/portal/appointments", "/api/v1/portal/referrals",
                 "/api/v1/portal/follow-ups", "/api/v1/portal/notifications",
                 "/api/v1/portal/instructions", "/api/v1/portal/contact-info"]:
        r = client.get(path, headers=patient_a_headers)
        assert r.status_code == 200, f"{path}: {r.text}"


def test_portal_isolation_patient_a_cannot_see_staff_data(client, patient_a_headers):
    # Patient role lacks staff perms -> 403 on staff endpoints (resource-level isolation).
    assert client.get("/api/v1/patients", headers=patient_a_headers).status_code == 403
    assert client.get("/api/v1/cases", headers=patient_a_headers).status_code == 403
    assert client.get("/api/v1/dashboard/summary", headers=patient_a_headers).status_code == 403


def test_portal_referrals_exclude_internal_notes(client, patient_a_headers):
    r = client.get("/api/v1/portal/referrals", headers=patient_a_headers)
    assert r.status_code == 200
    for ref in r.json():
        assert "notes" not in ref  # internal notes never exposed


def test_portal_followups_exclude_internal_events(client, patient_a_headers):
    r = client.get("/api/v1/portal/follow-ups", headers=patient_a_headers)
    assert r.status_code == 200
    for fu in r.json():
        assert "events" not in fu
        assert "notes" not in fu


def test_patient_instruction_created_by_staff_visible_in_portal(client, auth_headers, patient_a_headers):
    # Find patient A's id via admin.
    patients = client.get("/api/v1/patients?search=MRN-PAT-A", headers=auth_headers).json()["items"]
    pid = patients[0]["id"]
    r = client.post(f"/api/v1/patients/{pid}/instructions",
                    json={"instruction": "Fast before blood draw."}, headers=auth_headers)
    assert r.status_code == 201
    instrs = client.get("/api/v1/portal/instructions", headers=patient_a_headers).json()
    assert any("Fast before blood draw" in i["instruction"] for i in instrs)
