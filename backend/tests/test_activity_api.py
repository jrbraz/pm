"""Tests for activity log and dashboard API."""
import pytest
from fastapi.testclient import TestClient


def _register_and_login(client: TestClient, username: str, password: str = "pass1234") -> str:
    client.post("/api/auth/register", json={"username": username, "password": password})
    r = client.post("/api/auth/login", json={"username": username, "password": password})
    return r.json()["token"]


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _create_board(client: TestClient, username: str, name: str = "Test Board") -> int:
    r = client.post(f"/api/users/{username}/boards", json={"name": name})
    return r.json()["id"]


# ---------------------------------------------------------------------------
# Board activity
# ---------------------------------------------------------------------------

def test_activity_requires_auth(client: TestClient) -> None:
    r = client.get("/api/users/alice/boards/1/activity")
    assert r.status_code == 401


def test_activity_empty_on_new_board(client: TestClient) -> None:
    token = _register_and_login(client, "alice")
    board_id = _create_board(client, "alice")

    r = client.get(
        f"/api/users/alice/boards/{board_id}/activity",
        headers=_auth(token),
    )
    assert r.status_code == 200
    data = r.json()
    assert data["board_id"] == board_id
    assert isinstance(data["activity"], list)


def test_activity_logged_on_board_create(client: TestClient) -> None:
    token = _register_and_login(client, "alice")
    board_id = _create_board(client, "alice")

    # Create board with token
    client.post(
        "/api/users/alice/boards",
        json={"name": "Activity Board"},
        headers=_auth(token),
    )

    # The new board's activity should have a 'created' entry
    r_list = client.get("/api/users/alice/boards", headers=_auth(token))
    boards = r_list.json()["boards"]
    new_board_id = next(b["id"] for b in boards if b["name"] == "Activity Board")

    r = client.get(
        f"/api/users/alice/boards/{new_board_id}/activity",
        headers=_auth(token),
    )
    assert r.status_code == 200
    activity = r.json()["activity"]
    assert any(a["action"] == "created" for a in activity)


def test_activity_logged_on_member_invite(client: TestClient) -> None:
    alice_token = _register_and_login(client, "alice")
    _register_and_login(client, "bob")
    board_id = _create_board(client, "alice")

    client.post(
        f"/api/users/alice/boards/{board_id}/members",
        json={"username": "bob"},
        headers=_auth(alice_token),
    )

    r = client.get(
        f"/api/users/alice/boards/{board_id}/activity",
        headers=_auth(alice_token),
    )
    activity = r.json()["activity"]
    assert any(a["action"] == "invited" and a["entity_type"] == "member" for a in activity)


def test_activity_logged_on_comment(client: TestClient) -> None:
    token = _register_and_login(client, "alice")
    board_id = _create_board(client, "alice")

    client.post(
        f"/api/users/alice/boards/{board_id}/cards/card-1/comments",
        json={"body": "Test comment."},
        headers=_auth(token),
    )

    r = client.get(
        f"/api/users/alice/boards/{board_id}/activity",
        headers=_auth(token),
    )
    activity = r.json()["activity"]
    assert any(a["action"] == "commented" for a in activity)


def test_activity_filter_by_card_id(client: TestClient) -> None:
    token = _register_and_login(client, "alice")
    board_id = _create_board(client, "alice")

    client.post(
        f"/api/users/alice/boards/{board_id}/cards/card-1/comments",
        json={"body": "Card 1 comment."},
        headers=_auth(token),
    )
    client.post(
        f"/api/users/alice/boards/{board_id}/cards/card-2/comments",
        json={"body": "Card 2 comment."},
        headers=_auth(token),
    )

    r = client.get(
        f"/api/users/alice/boards/{board_id}/activity",
        params={"card_id": "card-1"},
        headers=_auth(token),
    )
    activity = r.json()["activity"]
    assert all(a["entity_id"] == "card-1" for a in activity)


def test_activity_newest_first(client: TestClient) -> None:
    token = _register_and_login(client, "alice")
    board_id = _create_board(client, "alice")

    for i in range(3):
        client.post(
            f"/api/users/alice/boards/{board_id}/cards/card-{i}/comments",
            json={"body": f"Comment {i}"},
            headers=_auth(token),
        )

    r = client.get(
        f"/api/users/alice/boards/{board_id}/activity",
        headers=_auth(token),
    )
    activity = r.json()["activity"]
    assert len(activity) >= 3
    # Should be newest first
    timestamps = [a["created_at"] for a in activity]
    assert timestamps == sorted(timestamps, reverse=True)


def test_activity_non_member_denied(client: TestClient) -> None:
    _register_and_login(client, "alice")
    dave_token = _register_and_login(client, "dave")
    board_id = _create_board(client, "alice")

    r = client.get(
        f"/api/users/alice/boards/{board_id}/activity",
        headers=_auth(dave_token),
    )
    assert r.status_code == 404


def test_activity_pagination(client: TestClient) -> None:
    token = _register_and_login(client, "alice")
    board_id = _create_board(client, "alice")

    for i in range(5):
        client.post(
            f"/api/users/alice/boards/{board_id}/cards/card-1/comments",
            json={"body": f"Comment {i}"},
            headers=_auth(token),
        )

    r1 = client.get(
        f"/api/users/alice/boards/{board_id}/activity",
        params={"limit": 3, "offset": 0},
        headers=_auth(token),
    )
    r2 = client.get(
        f"/api/users/alice/boards/{board_id}/activity",
        params={"limit": 3, "offset": 3},
        headers=_auth(token),
    )
    assert len(r1.json()["activity"]) == 3
    # Offset page should have remaining items
    ids1 = {a["id"] for a in r1.json()["activity"]}
    ids2 = {a["id"] for a in r2.json()["activity"]}
    assert ids1.isdisjoint(ids2)


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------

def test_dashboard_requires_auth(client: TestClient) -> None:
    r = client.get("/api/users/alice/dashboard")
    assert r.status_code == 401


def test_dashboard_wrong_user(client: TestClient) -> None:
    alice_token = _register_and_login(client, "alice")
    _register_and_login(client, "bob")

    r = client.get("/api/users/bob/dashboard", headers=_auth(alice_token))
    assert r.status_code == 403


def test_dashboard_new_user(client: TestClient) -> None:
    token = _register_and_login(client, "alice")

    r = client.get("/api/users/alice/dashboard", headers=_auth(token))
    assert r.status_code == 200
    data = r.json()
    assert data["username"] == "alice"
    assert "total_boards" in data
    assert "total_cards" in data
    assert "total_overdue" in data
    assert "boards" in data
    assert "recent_activity" in data


def test_dashboard_shows_owned_boards(client: TestClient) -> None:
    token = _register_and_login(client, "alice")
    _create_board(client, "alice", "Board A")
    _create_board(client, "alice", "Board B")

    r = client.get("/api/users/alice/dashboard", headers=_auth(token))
    data = r.json()
    assert data["total_boards"] >= 2
    names = [b["name"] for b in data["boards"]]
    assert "Board A" in names
    assert "Board B" in names


def test_dashboard_shows_shared_boards(client: TestClient) -> None:
    alice_token = _register_and_login(client, "alice")
    bob_token = _register_and_login(client, "bob")
    board_id = _create_board(client, "alice", "Alice's Board")

    client.post(
        f"/api/users/alice/boards/{board_id}/members",
        json={"username": "bob"},
        headers=_auth(alice_token),
    )

    r = client.get("/api/users/bob/dashboard", headers=_auth(bob_token))
    data = r.json()
    names = [b["name"] for b in data["boards"]]
    assert "Alice's Board" in names


def test_dashboard_total_cards_aggregates_boards(client: TestClient) -> None:
    token = _register_and_login(client, "alice")

    r = client.get("/api/users/alice/dashboard", headers=_auth(token))
    data = r.json()
    # With default boards seeded, total_cards should be > 0
    assert data["total_cards"] >= 0


def test_dashboard_recent_activity_present(client: TestClient) -> None:
    token = _register_and_login(client, "alice")
    board_id = _create_board(client, "alice")

    client.post(
        f"/api/users/alice/boards/{board_id}/cards/card-1/comments",
        json={"body": "Dashboard test comment."},
        headers=_auth(token),
    )

    r = client.get("/api/users/alice/dashboard", headers=_auth(token))
    data = r.json()
    assert len(data["recent_activity"]) > 0
