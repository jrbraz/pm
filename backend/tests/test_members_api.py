"""Tests for board member management API."""
import pytest
from fastapi.testclient import TestClient


def _register_and_login(client: TestClient, username: str, password: str = "pass1234") -> str:
    client.post("/api/auth/register", json={"username": username, "password": password})
    r = client.post("/api/auth/login", json={"username": username, "password": password})
    return r.json()["token"]


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _create_board(client: TestClient, username: str, token: str, name: str = "Test Board") -> int:
    r = client.post(f"/api/users/{username}/boards", json={"name": name}, headers=_auth(token))
    assert r.status_code == 201
    return r.json()["id"]


# ---------------------------------------------------------------------------
# List members
# ---------------------------------------------------------------------------

def test_list_members_requires_auth(client: TestClient) -> None:
    r = client.get("/api/users/alice/boards/999/members")
    assert r.status_code == 401


def test_list_members_empty_board(client: TestClient) -> None:
    token = _register_and_login(client, "alice")
    board_id = _create_board(client, "alice", token)
    r = client.get(f"/api/users/alice/boards/{board_id}/members", headers=_auth(token))
    assert r.status_code == 200
    data = r.json()
    assert data["board_id"] == board_id
    assert data["members"] == []


def test_list_members_board_not_found(client: TestClient) -> None:
    token = _register_and_login(client, "alice")
    r = client.get("/api/users/alice/boards/99999/members", headers=_auth(token))
    assert r.status_code == 404


# ---------------------------------------------------------------------------
# Add member
# ---------------------------------------------------------------------------

def test_add_member_requires_auth(client: TestClient) -> None:
    r = client.post("/api/users/alice/boards/1/members", json={"username": "bob"})
    assert r.status_code == 401


def test_add_member_success(client: TestClient) -> None:
    alice_token = _register_and_login(client, "alice")
    _register_and_login(client, "bob")
    board_id = _create_board(client, "alice", alice_token)

    r = client.post(
        f"/api/users/alice/boards/{board_id}/members",
        json={"username": "bob", "role": "member"},
        headers=_auth(alice_token),
    )
    assert r.status_code == 201
    data = r.json()
    assert data["username"] == "bob"
    assert data["role"] == "member"


def test_add_member_viewer_role(client: TestClient) -> None:
    alice_token = _register_and_login(client, "alice")
    _register_and_login(client, "charlie")
    board_id = _create_board(client, "alice", alice_token)

    r = client.post(
        f"/api/users/alice/boards/{board_id}/members",
        json={"username": "charlie", "role": "viewer"},
        headers=_auth(alice_token),
    )
    assert r.status_code == 201
    assert r.json()["role"] == "viewer"


def test_add_member_appears_in_list(client: TestClient) -> None:
    alice_token = _register_and_login(client, "alice")
    _register_and_login(client, "bob")
    board_id = _create_board(client, "alice", alice_token)

    client.post(
        f"/api/users/alice/boards/{board_id}/members",
        json={"username": "bob"},
        headers=_auth(alice_token),
    )
    r = client.get(f"/api/users/alice/boards/{board_id}/members", headers=_auth(alice_token))
    assert r.status_code == 200
    members = r.json()["members"]
    assert len(members) == 1
    assert members[0]["username"] == "bob"


def test_add_nonexistent_user_returns_404(client: TestClient) -> None:
    alice_token = _register_and_login(client, "alice")
    board_id = _create_board(client, "alice", alice_token)

    r = client.post(
        f"/api/users/alice/boards/{board_id}/members",
        json={"username": "nobody"},
        headers=_auth(alice_token),
    )
    assert r.status_code == 404


def test_add_duplicate_member_returns_409(client: TestClient) -> None:
    alice_token = _register_and_login(client, "alice")
    _register_and_login(client, "bob")
    board_id = _create_board(client, "alice", alice_token)

    client.post(
        f"/api/users/alice/boards/{board_id}/members",
        json={"username": "bob"},
        headers=_auth(alice_token),
    )
    r = client.post(
        f"/api/users/alice/boards/{board_id}/members",
        json={"username": "bob"},
        headers=_auth(alice_token),
    )
    assert r.status_code == 409


def test_non_owner_cannot_add_member(client: TestClient) -> None:
    alice_token = _register_and_login(client, "alice")
    bob_token = _register_and_login(client, "bob")
    board_id = _create_board(client, "alice", alice_token)

    # Add bob as member
    client.post(
        f"/api/users/alice/boards/{board_id}/members",
        json={"username": "bob"},
        headers=_auth(alice_token),
    )

    # Bob tries to add charlie
    _register_and_login(client, "charlie")
    r = client.post(
        f"/api/users/alice/boards/{board_id}/members",
        json={"username": "charlie"},
        headers=_auth(bob_token),
    )
    assert r.status_code == 403


def test_owner_cannot_be_added_as_member(client: TestClient) -> None:
    alice_token = _register_and_login(client, "alice")
    board_id = _create_board(client, "alice", alice_token)

    r = client.post(
        f"/api/users/alice/boards/{board_id}/members",
        json={"username": "alice"},
        headers=_auth(alice_token),
    )
    assert r.status_code == 409


# ---------------------------------------------------------------------------
# Update member role
# ---------------------------------------------------------------------------

def test_update_member_role(client: TestClient) -> None:
    alice_token = _register_and_login(client, "alice")
    _register_and_login(client, "bob")
    board_id = _create_board(client, "alice", alice_token)

    client.post(
        f"/api/users/alice/boards/{board_id}/members",
        json={"username": "bob", "role": "member"},
        headers=_auth(alice_token),
    )

    r = client.patch(
        f"/api/users/alice/boards/{board_id}/members/bob",
        json={"role": "viewer"},
        headers=_auth(alice_token),
    )
    assert r.status_code == 200
    assert r.json()["role"] == "viewer"


def test_update_role_requires_owner(client: TestClient) -> None:
    alice_token = _register_and_login(client, "alice")
    bob_token = _register_and_login(client, "bob")
    _register_and_login(client, "charlie")
    board_id = _create_board(client, "alice", alice_token)

    client.post(
        f"/api/users/alice/boards/{board_id}/members",
        json={"username": "bob"},
        headers=_auth(alice_token),
    )
    client.post(
        f"/api/users/alice/boards/{board_id}/members",
        json={"username": "charlie"},
        headers=_auth(alice_token),
    )

    r = client.patch(
        f"/api/users/alice/boards/{board_id}/members/charlie",
        json={"role": "viewer"},
        headers=_auth(bob_token),
    )
    assert r.status_code == 403


# ---------------------------------------------------------------------------
# Remove member
# ---------------------------------------------------------------------------

def test_remove_member(client: TestClient) -> None:
    alice_token = _register_and_login(client, "alice")
    _register_and_login(client, "bob")
    board_id = _create_board(client, "alice", alice_token)

    client.post(
        f"/api/users/alice/boards/{board_id}/members",
        json={"username": "bob"},
        headers=_auth(alice_token),
    )
    r = client.delete(
        f"/api/users/alice/boards/{board_id}/members/bob",
        headers=_auth(alice_token),
    )
    assert r.status_code == 204

    r = client.get(f"/api/users/alice/boards/{board_id}/members", headers=_auth(alice_token))
    assert r.json()["members"] == []


def test_member_can_remove_themselves(client: TestClient) -> None:
    alice_token = _register_and_login(client, "alice")
    bob_token = _register_and_login(client, "bob")
    board_id = _create_board(client, "alice", alice_token)

    client.post(
        f"/api/users/alice/boards/{board_id}/members",
        json={"username": "bob"},
        headers=_auth(alice_token),
    )
    r = client.delete(
        f"/api/users/alice/boards/{board_id}/members/bob",
        headers=_auth(bob_token),
    )
    assert r.status_code == 204


def test_member_cannot_remove_other_member(client: TestClient) -> None:
    alice_token = _register_and_login(client, "alice")
    bob_token = _register_and_login(client, "bob")
    _register_and_login(client, "charlie")
    board_id = _create_board(client, "alice", alice_token)

    client.post(
        f"/api/users/alice/boards/{board_id}/members",
        json={"username": "bob"},
        headers=_auth(alice_token),
    )
    client.post(
        f"/api/users/alice/boards/{board_id}/members",
        json={"username": "charlie"},
        headers=_auth(alice_token),
    )

    r = client.delete(
        f"/api/users/alice/boards/{board_id}/members/charlie",
        headers=_auth(bob_token),
    )
    assert r.status_code == 403


# ---------------------------------------------------------------------------
# Member board access
# ---------------------------------------------------------------------------

def test_member_can_read_board(client: TestClient) -> None:
    alice_token = _register_and_login(client, "alice")
    bob_token = _register_and_login(client, "bob")
    board_id = _create_board(client, "alice", alice_token)

    client.post(
        f"/api/users/alice/boards/{board_id}/members",
        json={"username": "bob"},
        headers=_auth(alice_token),
    )

    r = client.get(
        f"/api/users/alice/boards/{board_id}",
        headers=_auth(bob_token),
    )
    assert r.status_code == 200


def test_member_can_save_board(client: TestClient) -> None:
    alice_token = _register_and_login(client, "alice")
    bob_token = _register_and_login(client, "bob")
    board_id = _create_board(client, "alice", alice_token)

    client.post(
        f"/api/users/alice/boards/{board_id}/members",
        json={"username": "bob"},
        headers=_auth(alice_token),
    )

    # Fetch the board as bob
    r = client.get(
        f"/api/users/alice/boards/{board_id}",
        headers=_auth(bob_token),
    )
    board_data = r.json()["board"]

    # Bob saves a modification
    r = client.put(
        f"/api/users/alice/boards/{board_id}",
        json=board_data,
        headers=_auth(bob_token),
    )
    assert r.status_code == 200


def test_viewer_cannot_save_board(client: TestClient) -> None:
    alice_token = _register_and_login(client, "alice")
    charlie_token = _register_and_login(client, "charlie")
    board_id = _create_board(client, "alice", alice_token)

    client.post(
        f"/api/users/alice/boards/{board_id}/members",
        json={"username": "charlie", "role": "viewer"},
        headers=_auth(alice_token),
    )

    r = client.get(
        f"/api/users/alice/boards/{board_id}",
        headers=_auth(charlie_token),
    )
    board_data = r.json()["board"]

    r = client.put(
        f"/api/users/alice/boards/{board_id}",
        json=board_data,
        headers=_auth(charlie_token),
    )
    assert r.status_code == 403


def test_non_member_cannot_read_board_with_token(client: TestClient) -> None:
    alice_token = _register_and_login(client, "alice")
    dave_token = _register_and_login(client, "dave")
    board_id = _create_board(client, "alice", alice_token)

    r = client.get(
        f"/api/users/alice/boards/{board_id}",
        headers=_auth(dave_token),
    )
    assert r.status_code == 404
