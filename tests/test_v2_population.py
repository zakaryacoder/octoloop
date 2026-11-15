"""V2 Phase 5 population health tests: aggregated/anonymized only, no patient identifiers,
CSV export, permission gate."""
import json


def test_population_requires_permission(client):
    assert client.get("/api/v1/population/overview").status_code == 401


def test_population_overview_aggregated_no_patient_id(client, auth_headers):
    r = client.get("/api/v1/population/overview", headers=auth_headers)
    assert r.status_code == 200, r.text
    body = r.json()
    for key in ["screening_coverage_rate", "abnormal_rate", "follow_up_completion_rate",
                "avg_days_to_consultation", "delayed_care_count", "referral_completion_rate", "by_type"]:
        assert key in body, f"missing {key}"
    # No patient identifiers anywhere in payload.
    blob = json.dumps(body)
    assert "patient_id" not in blob
    assert "mrn" not in blob.lower()
    assert "first_name" not in blob
    assert body["disclaimer"]


def test_population_endpoints_return_aggregates(client, auth_headers):
    for path in ["/api/v1/population/coverage", "/api/v1/population/geographic",
                 "/api/v1/population/delayed-care", "/api/v1/population/trends?months=6"]:
        r = client.get(path, headers=auth_headers)
        assert r.status_code == 200, f"{path}: {r.text}"
        assert isinstance(r.json(), list)
        blob = json.dumps(r.json())
        assert "patient_id" not in blob, f"{path} leaked patient_id"
        assert "mrn" not in blob.lower(), f"{path} leaked mrn"


def test_population_export_csv(client, auth_headers):
    r = client.get("/api/v1/population/export?format=csv", headers=auth_headers)
    assert r.status_code == 200
    assert "text/csv" in r.headers["content-type"]
    assert "attachment" in r.headers["content-disposition"]
    content = r.text
    assert "screening_coverage_rate" in content
    assert "patient_id" not in content
    assert "mrn" not in content.lower()


def test_population_denied_for_patient_role(client, patient_a_headers):
    assert client.get("/api/v1/population/overview", headers=patient_a_headers).status_code == 403
