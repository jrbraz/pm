from fastapi.testclient import TestClient


def test_get_profile_for_existing_user(client: TestClient) -> None:
    # Create user via board access (legacy)
    client.get("/api/users/testuser/board")
    response = client.get("/api/users/testuser/profile")
    assert response.status_code == 200
    body = response.json()
    assert body["username"] == "testuser"
    assert "id" in body


def test_get_profile_for_registered_user(client: TestClient) -> None:
    client.post("/api/auth/register", json={"username": "alice", "password": "pass1234"})
    response = client.get("/api/users/alice/profile")
    assert response.status_code == 200
    body = response.json()
    assert body["username"] == "alice"
    assert body["has_password"] is True


def test_get_profile_unknown_user_returns_404(client: TestClient) -> None:
    response = client.get("/api/users/nobody/profile")
    assert response.status_code == 404


def test_change_password_succeeds(client: TestClient) -> None:
    client.post("/api/auth/register", json={"username": "bob", "password": "oldpass"})
    response = client.post(
        "/api/users/bob/change-password",
        json={"current_password": "oldpass", "new_password": "newpass123"},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

    # Can now login with new password
    login_resp = client.post("/api/auth/login", json={"username": "bob", "password": "newpass123"})
    assert login_resp.status_code == 200


def test_change_password_wrong_current_returns_401(client: TestClient) -> None:
    client.post("/api/auth/register", json={"username": "carol", "password": "correctpass"})
    response = client.post(
        "/api/users/carol/change-password",
        json={"current_password": "wrongpass", "new_password": "newpass"},
    )
    assert response.status_code == 401


def test_change_password_too_short_returns_400(client: TestClient) -> None:
    client.post("/api/auth/register", json={"username": "dave", "password": "mypassword"})
    response = client.post(
        "/api/users/dave/change-password",
        json={"current_password": "mypassword", "new_password": "ab"},
    )
    assert response.status_code == 400


def test_duplicate_board(client: TestClient) -> None:
    create_resp = client.post("/api/users/user/boards", json={"name": "Original"})
    board_id = create_resp.json()["id"]

    # Put some content in it
    payload = {
        "columns": [{"id": "col-1", "title": "Todo", "cardIds": ["c1"]}],
        "cards": {"c1": {"id": "c1", "title": "Task", "details": "Details"}},
    }
    client.put(f"/api/users/user/boards/{board_id}", json=payload)

    # Duplicate it
    dup_resp = client.post(
        f"/api/users/user/boards/{board_id}/duplicate",
        json={"name": "Original (Copy)"},
    )
    assert dup_resp.status_code == 201
    dup = dup_resp.json()
    assert dup["name"] == "Original (Copy)"
    assert dup["board"]["cards"]["c1"]["title"] == "Task"
    assert dup["id"] != board_id


def test_duplicate_nonexistent_board_returns_404(client: TestClient) -> None:
    response = client.post(
        "/api/users/user/boards/99999/duplicate",
        json={"name": "Copy"},
    )
    assert response.status_code == 404


def test_duplicate_board_empty_name_returns_400(client: TestClient) -> None:
    create_resp = client.post("/api/users/user/boards", json={"name": "Board"})
    board_id = create_resp.json()["id"]
    response = client.post(
        f"/api/users/user/boards/{board_id}/duplicate",
        json={"name": "   "},
    )
    assert response.status_code == 400
