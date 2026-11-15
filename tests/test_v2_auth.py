"""V2 Phase 3 auth tests: refresh token rotation, revocation, family-reuse detection,
logout invalidation, logout-all, persistent lockout persists, rate limit."""


def _login(client, username="admin", password="Admin@12345"):
    r = client.post("/api/v1/auth/login", json={"username": username, "password": password})
    assert r.status_code == 200, r.text
    return r.json()


def test_login_returns_refresh_token_and_expires_in(client):
    body = _login(client)
    assert "refresh_token" in body and body["refresh_token"]
    assert body["expires_in"] == 900  # 15 min * 60


def test_refresh_rotation_returns_new_tokens(client):
    body = _login(client)
    rt1 = body["refresh_token"]
    r = client.post("/api/v1/auth/refresh", json={"refresh_token": rt1})
    assert r.status_code == 200, r.text
    refreshed = r.json()
    assert refreshed["access_token"]
    assert refreshed["refresh_token"] and refreshed["refresh_token"] != rt1
    assert refreshed["expires_in"] == 900


def test_old_refresh_token_revoked_after_rotation(client):
    body = _login(client)
    rt1 = body["refresh_token"]
    client.post("/api/v1/auth/refresh", json={"refresh_token": rt1})
    # Reusing the old (rotated) token -> 401 + entire family revoked.
    r = client.post("/api/v1/auth/refresh", json={"refresh_token": rt1})
    assert r.status_code == 401
    assert "family" in r.json()["detail"].lower() or "revoked" in r.json()["detail"].lower()


def test_reuse_revokes_entire_family(client):
    body = _login(client)
    rt1 = body["refresh_token"]
    r2 = client.post("/api/v1/auth/refresh", json={"refresh_token": rt1}).json()
    rt2 = r2["refresh_token"]
    # Reuse rt1 -> family revoked.
    client.post("/api/v1/auth/refresh", json={"refresh_token": rt1})
    # Now rt2 (valid member of same family) must also be rejected.
    r = client.post("/api/v1/auth/refresh", json={"refresh_token": rt2})
    assert r.status_code == 401


def test_invalid_refresh_token_401(client):
    r = client.post("/api/v1/auth/refresh", json={"refresh_token": "not-a-real-token"})
    assert r.status_code == 401


def test_logout_revokes_refresh_token(client):
    body = _login(client)
    rt = body["refresh_token"]
    headers = {"Authorization": f"Bearer {body['access_token']}"}
    r = client.post("/api/v1/auth/logout", json={"refresh_token": rt}, headers=headers)
    assert r.status_code == 200
    # After logout, refresh token is revoked.
    r2 = client.post("/api/v1/auth/refresh", json={"refresh_token": rt})
    assert r2.status_code == 401


def test_logout_all_revokes_all_tokens(client):
    b1 = _login(client)
    b2 = _login(client)  # second session, same user -> second refresh token
    headers = {"Authorization": f"Bearer {b1['access_token']}"}
    r = client.post("/api/v1/auth/logout-all", headers=headers)
    assert r.status_code == 200
    assert r.json()["revoked"] >= 2
    assert client.post("/api/v1/auth/refresh", json={"refresh_token": b1["refresh_token"]}).status_code == 401
    assert client.post("/api/v1/auth/refresh", json={"refresh_token": b2["refresh_token"]}).status_code == 401


def test_persistent_lockout_columns_set(client, db_session):
    from app.models.user import User
    for _ in range(5):
        client.post("/api/v1/auth/login", json={"username": "dr.smith", "password": "wrong"})
    u = db_session.query(User).filter(User.username == "dr.smith").first()
    assert u.locked_until is not None
    # 6th attempt locked -> 423.
    r = client.post("/api/v1/auth/login", json={"username": "dr.smith", "password": "Clinician@123"})
    assert r.status_code == 423
