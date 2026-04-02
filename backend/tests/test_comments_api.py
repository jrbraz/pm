"""Tests for card comments API."""
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
    return r.json()["id"]


# ---------------------------------------------------------------------------
# List comments
# ---------------------------------------------------------------------------

def test_list_comments_requires_auth(client: TestClient) -> None:
    r = client.get("/api/users/alice/boards/1/cards/card-1/comments")
    assert r.status_code == 401


def test_list_comments_empty(client: TestClient) -> None:
    token = _register_and_login(client, "alice")
    board_id = _create_board(client, "alice", token)
    r = client.get(
        f"/api/users/alice/boards/{board_id}/cards/card-1/comments",
        headers=_auth(token),
    )
    assert r.status_code == 200
    assert r.json()["comments"] == []


def test_list_comments_board_not_found(client: TestClient) -> None:
    token = _register_and_login(client, "alice")
    r = client.get(
        "/api/users/alice/boards/99999/cards/card-1/comments",
        headers=_auth(token),
    )
    assert r.status_code == 404


# ---------------------------------------------------------------------------
# Create comment
# ---------------------------------------------------------------------------

def test_create_comment_success(client: TestClient) -> None:
    token = _register_and_login(client, "alice")
    board_id = _create_board(client, "alice", token)

    r = client.post(
        f"/api/users/alice/boards/{board_id}/cards/card-1/comments",
        json={"body": "This is a comment."},
        headers=_auth(token),
    )
    assert r.status_code == 201
    data = r.json()
    assert data["body"] == "This is a comment."
    assert data["username"] == "alice"
    assert data["card_id"] == "card-1"


def test_create_comment_appears_in_list(client: TestClient) -> None:
    token = _register_and_login(client, "alice")
    board_id = _create_board(client, "alice", token)

    client.post(
        f"/api/users/alice/boards/{board_id}/cards/card-1/comments",
        json={"body": "First comment."},
        headers=_auth(token),
    )
    client.post(
        f"/api/users/alice/boards/{board_id}/cards/card-1/comments",
        json={"body": "Second comment."},
        headers=_auth(token),
    )

    r = client.get(
        f"/api/users/alice/boards/{board_id}/cards/card-1/comments",
        headers=_auth(token),
    )
    comments = r.json()["comments"]
    assert len(comments) == 2
    assert comments[0]["body"] == "First comment."
    assert comments[1]["body"] == "Second comment."


def test_create_comment_empty_body_rejected(client: TestClient) -> None:
    token = _register_and_login(client, "alice")
    board_id = _create_board(client, "alice", token)

    r = client.post(
        f"/api/users/alice/boards/{board_id}/cards/card-1/comments",
        json={"body": "   "},
        headers=_auth(token),
    )
    assert r.status_code == 400


def test_create_comment_requires_auth(client: TestClient) -> None:
    r = client.post(
        "/api/users/alice/boards/1/cards/card-1/comments",
        json={"body": "hello"},
    )
    assert r.status_code == 401


def test_viewer_cannot_create_comment(client: TestClient) -> None:
    alice_token = _register_and_login(client, "alice")
    charlie_token = _register_and_login(client, "charlie")
    board_id = _create_board(client, "alice", alice_token)

    # Add charlie as viewer
    client.post(
        f"/api/users/alice/boards/{board_id}/members",
        json={"username": "charlie", "role": "viewer"},
        headers=_auth(alice_token),
    )

    r = client.post(
        f"/api/users/alice/boards/{board_id}/cards/card-1/comments",
        json={"body": "Can I comment?"},
        headers=_auth(charlie_token),
    )
    assert r.status_code == 403


def test_member_can_create_comment(client: TestClient) -> None:
    alice_token = _register_and_login(client, "alice")
    bob_token = _register_and_login(client, "bob")
    board_id = _create_board(client, "alice", alice_token)

    client.post(
        f"/api/users/alice/boards/{board_id}/members",
        json={"username": "bob"},
        headers=_auth(alice_token),
    )

    r = client.post(
        f"/api/users/alice/boards/{board_id}/cards/card-1/comments",
        json={"body": "Bob's comment."},
        headers=_auth(bob_token),
    )
    assert r.status_code == 201
    assert r.json()["username"] == "bob"


# ---------------------------------------------------------------------------
# Update comment
# ---------------------------------------------------------------------------

def test_update_own_comment(client: TestClient) -> None:
    token = _register_and_login(client, "alice")
    board_id = _create_board(client, "alice", token)

    r = client.post(
        f"/api/users/alice/boards/{board_id}/cards/card-1/comments",
        json={"body": "Original."},
        headers=_auth(token),
    )
    comment_id = r.json()["id"]

    r = client.patch(
        f"/api/users/alice/boards/{board_id}/cards/card-1/comments/{comment_id}",
        json={"body": "Edited."},
        headers=_auth(token),
    )
    assert r.status_code == 200
    assert r.json()["body"] == "Edited."


def test_cannot_edit_others_comment(client: TestClient) -> None:
    alice_token = _register_and_login(client, "alice")
    bob_token = _register_and_login(client, "bob")
    board_id = _create_board(client, "alice", alice_token)

    client.post(
        f"/api/users/alice/boards/{board_id}/members",
        json={"username": "bob"},
        headers=_auth(alice_token),
    )

    r = client.post(
        f"/api/users/alice/boards/{board_id}/cards/card-1/comments",
        json={"body": "Alice's comment."},
        headers=_auth(alice_token),
    )
    comment_id = r.json()["id"]

    r = client.patch(
        f"/api/users/alice/boards/{board_id}/cards/card-1/comments/{comment_id}",
        json={"body": "Bob hijacks."},
        headers=_auth(bob_token),
    )
    assert r.status_code == 403


# ---------------------------------------------------------------------------
# Delete comment
# ---------------------------------------------------------------------------

def test_delete_own_comment(client: TestClient) -> None:
    token = _register_and_login(client, "alice")
    board_id = _create_board(client, "alice", token)

    r = client.post(
        f"/api/users/alice/boards/{board_id}/cards/card-1/comments",
        json={"body": "To be deleted."},
        headers=_auth(token),
    )
    comment_id = r.json()["id"]

    r = client.delete(
        f"/api/users/alice/boards/{board_id}/cards/card-1/comments/{comment_id}",
        headers=_auth(token),
    )
    assert r.status_code == 204

    r = client.get(
        f"/api/users/alice/boards/{board_id}/cards/card-1/comments",
        headers=_auth(token),
    )
    assert r.json()["comments"] == []


def test_board_owner_can_delete_any_comment(client: TestClient) -> None:
    alice_token = _register_and_login(client, "alice")
    bob_token = _register_and_login(client, "bob")
    board_id = _create_board(client, "alice", alice_token)

    client.post(
        f"/api/users/alice/boards/{board_id}/members",
        json={"username": "bob"},
        headers=_auth(alice_token),
    )

    r = client.post(
        f"/api/users/alice/boards/{board_id}/cards/card-1/comments",
        json={"body": "Bob's comment."},
        headers=_auth(bob_token),
    )
    comment_id = r.json()["id"]

    # Alice (owner) deletes Bob's comment
    r = client.delete(
        f"/api/users/alice/boards/{board_id}/cards/card-1/comments/{comment_id}",
        headers=_auth(alice_token),
    )
    assert r.status_code == 204


def test_member_cannot_delete_others_comment(client: TestClient) -> None:
    alice_token = _register_and_login(client, "alice")
    bob_token = _register_and_login(client, "bob")
    board_id = _create_board(client, "alice", alice_token)

    client.post(
        f"/api/users/alice/boards/{board_id}/members",
        json={"username": "bob"},
        headers=_auth(alice_token),
    )

    r = client.post(
        f"/api/users/alice/boards/{board_id}/cards/card-1/comments",
        json={"body": "Alice's comment."},
        headers=_auth(alice_token),
    )
    comment_id = r.json()["id"]

    r = client.delete(
        f"/api/users/alice/boards/{board_id}/cards/card-1/comments/{comment_id}",
        headers=_auth(bob_token),
    )
    assert r.status_code == 403
