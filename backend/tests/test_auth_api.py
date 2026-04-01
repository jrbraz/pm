from fastapi.testclient import TestClient


def test_register_creates_user(client: TestClient) -> None:
    response = client.post("/api/auth/register", json={"username": "alice", "password": "secret123"})
    assert response.status_code == 200
    body = response.json()
    assert body["username"] == "alice"
    assert "id" in body


def test_register_duplicate_username_returns_400(client: TestClient) -> None:
    client.post("/api/auth/register", json={"username": "alice", "password": "secret123"})
    response = client.post("/api/auth/register", json={"username": "alice", "password": "other"})
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "REGISTRATION_ERROR"


def test_register_short_password_returns_400(client: TestClient) -> None:
    response = client.post("/api/auth/register", json={"username": "bob", "password": "123"})
    assert response.status_code == 400


def test_register_short_username_returns_400(client: TestClient) -> None:
    response = client.post("/api/auth/register", json={"username": "a", "password": "validpass"})
    assert response.status_code == 400


def test_login_after_register_returns_token(client: TestClient) -> None:
    client.post("/api/auth/register", json={"username": "bob", "password": "password1"})
    response = client.post("/api/auth/login", json={"username": "bob", "password": "password1"})
    assert response.status_code == 200
    body = response.json()
    assert "token" in body
    assert body["username"] == "bob"


def test_login_wrong_password_returns_401(client: TestClient) -> None:
    client.post("/api/auth/register", json={"username": "carol", "password": "rightpass"})
    response = client.post("/api/auth/login", json={"username": "carol", "password": "wrongpass"})
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "AUTH_ERROR"


def test_login_unknown_user_returns_401(client: TestClient) -> None:
    response = client.post("/api/auth/login", json={"username": "nobody", "password": "pass"})
    assert response.status_code == 401


def test_logout_succeeds(client: TestClient) -> None:
    client.post("/api/auth/register", json={"username": "dave", "password": "pass1234"})
    login_resp = client.post("/api/auth/login", json={"username": "dave", "password": "pass1234"})
    token = login_resp.json()["token"]

    response = client.post("/api/auth/logout", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
