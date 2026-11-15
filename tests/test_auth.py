def test_login_success(client):
    r = client.post("/api/v1/auth/login", json={"username": "admin", "password": "Admin@12345"})
    assert r.status_code == 200
    body = r.json()
    assert body["token_type"] == "bearer"
    assert body["access_token"]
    assert body["user"]["username"] == "admin"
    assert body["user"]["role"] == "admin"


def test_login_bad_credentials(client):
    r = client.post("/api/v1/auth/login", json={"username": "admin", "password": "wrong"})
    assert r.status_code == 401


def test_login_lockout_after_5_fails(client):
    for _ in range(5):
        r = client.post("/api/v1/auth/login", json={"username": "admin", "password": "wrong"})
        assert r.status_code == 401
    # 6th attempt is locked (V2: persistent lockout -> 423 Locked) even with correct password
    r = client.post("/api/v1/auth/login", json={"username": "admin", "password": "Admin@12345"})
    assert r.status_code == 423


def test_me_requires_auth(client):
    assert client.get("/api/v1/auth/me").status_code == 401


def test_me_with_token(client, auth_headers):
    r = client.get("/api/v1/auth/me", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["username"] == "admin"


def test_logout_writes_ok(client, auth_headers):
    r = client.post("/api/v1/auth/logout", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["ok"] is True
