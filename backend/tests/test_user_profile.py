from fastapi.testclient import TestClient


def _register_and_login(client: TestClient, username: str, password: str = "pass1234") -> str:
    client.post("/api/auth/register", json={"username": username, "password": password})
    r = client.post("/api/auth/login", json={"username": username, "password": password})
    return r.json()["token"]


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def test_get_profile_for_registered_user(client: TestClient) -> None:
    token = _register_and_login(client, "alice")
    response = client.get("/api/users/alice/profile", headers=_auth(token))
    assert response.status_code == 200
    body = response.json()
    assert body["username"] == "alice"
    assert body["has_password"] is True


def test_get_profile_unknown_user_returns_404(client: TestClient) -> None:
    token = _register_and_login(client, "alice")
    response = client.get("/api/users/nobody/profile", headers=_auth(token))
    assert response.status_code == 404


def test_change_password_succeeds(client: TestClient) -> None:
    token = _register_and_login(client, "bob", "oldpass1234")
    response = client.post(
        "/api/users/bob/change-password",
        json={"current_password": "oldpass1234", "new_password": "newpass1234"},
        headers=_auth(token),
    )
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

    # Can now login with new password
    login_resp = client.post("/api/auth/login", json={"username": "bob", "password": "newpass1234"})
    assert login_resp.status_code == 200


def test_change_password_wrong_current_returns_401(client: TestClient) -> None:
    token = _register_and_login(client, "carol", "correctpass1")
    response = client.post(
        "/api/users/carol/change-password",
        json={"current_password": "wrongpass1", "new_password": "newpass12"},
        headers=_auth(token),
    )
    assert response.status_code == 401


def test_change_password_too_short_returns_400(client: TestClient) -> None:
    token = _register_and_login(client, "dave", "mypassword1")
    response = client.post(
        "/api/users/dave/change-password",
        json={"current_password": "mypassword1", "new_password": "ab"},
        headers=_auth(token),
    )
    assert response.status_code == 400


def test_duplicate_board(auth_client) -> None:
    client, token, username = auth_client
    create_resp = client.post(f"/api/users/{username}/boards", json={"name": "Original"})
    board_id = create_resp.json()["id"]

    # Put some content in it
    payload = {
        "columns": [{"id": "col-1", "title": "Todo", "cardIds": ["c1"]}],
        "cards": {"c1": {"id": "c1", "title": "Task", "details": "Details"}},
    }
    client.put(f"/api/users/{username}/boards/{board_id}", json=payload)

    # Duplicate it
    dup_resp = client.post(
        f"/api/users/{username}/boards/{board_id}/duplicate",
        json={"name": "Original (Copy)"},
    )
    assert dup_resp.status_code == 201
    dup = dup_resp.json()
    assert dup["name"] == "Original (Copy)"
    assert dup["board"]["cards"]["c1"]["title"] == "Task"
    assert dup["id"] != board_id


def test_duplicate_nonexistent_board_returns_404(auth_client) -> None:
    client, token, username = auth_client
    response = client.post(
        f"/api/users/{username}/boards/99999/duplicate",
        json={"name": "Copy"},
    )
    assert response.status_code == 404


def test_duplicate_board_empty_name_returns_400(auth_client) -> None:
    client, token, username = auth_client
    create_resp = client.post(f"/api/users/{username}/boards", json={"name": "Board"})
    board_id = create_resp.json()["id"]
    response = client.post(
        f"/api/users/{username}/boards/{board_id}/duplicate",
        json={"name": "   "},
    )
    assert response.status_code == 400
