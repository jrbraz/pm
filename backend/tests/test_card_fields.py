"""Tests for new card fields: checklist and assignee_ids."""
import pytest
from fastapi.testclient import TestClient


def _register_and_login(client: TestClient, username: str, password: str = "pass1234") -> str:
    client.post("/api/auth/register", json={"username": username, "password": password})
    r = client.post("/api/auth/login", json={"username": username, "password": password})
    return r.json()["token"]


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _get_board(client: TestClient, username: str, board_id: int, token: str) -> dict:
    r = client.get(f"/api/users/{username}/boards/{board_id}", headers=_auth(token))
    return r.json()["board"]


def _save_board(client: TestClient, username: str, board_id: int, board: dict, token: str) -> None:
    r = client.put(f"/api/users/{username}/boards/{board_id}", json=board, headers=_auth(token))
    assert r.status_code == 200


# ---------------------------------------------------------------------------
# Checklist fields
# ---------------------------------------------------------------------------

def test_card_with_checklist_round_trips(client: TestClient) -> None:
    token = _register_and_login(client, "alice")
    r = client.get("/api/users/alice/board", headers=_auth(token))
    board = r.json()["board"]

    # Add checklist to first card
    first_card_id = board["columns"][0]["cardIds"][0]
    board["cards"][first_card_id]["checklist"] = [
        {"id": "item-1", "text": "First step", "done": False},
        {"id": "item-2", "text": "Second step", "done": True},
    ]

    r = client.put("/api/users/alice/board", json=board, headers=_auth(token))
    assert r.status_code == 200

    # Reload and verify
    r = client.get("/api/users/alice/board", headers=_auth(token))
    saved_board = r.json()["board"]
    checklist = saved_board["cards"][first_card_id]["checklist"]
    assert len(checklist) == 2
    assert checklist[0]["text"] == "First step"
    assert checklist[0]["done"] is False
    assert checklist[1]["text"] == "Second step"
    assert checklist[1]["done"] is True


def test_card_checklist_check_off(client: TestClient) -> None:
    token = _register_and_login(client, "alice")
    r = client.get("/api/users/alice/board", headers=_auth(token))
    board = r.json()["board"]

    first_card_id = board["columns"][0]["cardIds"][0]
    board["cards"][first_card_id]["checklist"] = [
        {"id": "item-1", "text": "Do this", "done": False},
    ]
    client.put("/api/users/alice/board", json=board, headers=_auth(token))

    # Now check it off
    board["cards"][first_card_id]["checklist"][0]["done"] = True
    r = client.put("/api/users/alice/board", json=board, headers=_auth(token))
    assert r.status_code == 200

    r = client.get("/api/users/alice/board", headers=_auth(token))
    checklist = r.json()["board"]["cards"][first_card_id]["checklist"]
    assert checklist[0]["done"] is True


def test_card_checklist_remove_item(client: TestClient) -> None:
    token = _register_and_login(client, "alice")
    r = client.get("/api/users/alice/board", headers=_auth(token))
    board = r.json()["board"]

    first_card_id = board["columns"][0]["cardIds"][0]
    board["cards"][first_card_id]["checklist"] = [
        {"id": "item-1", "text": "Keep", "done": False},
        {"id": "item-2", "text": "Remove", "done": False},
    ]
    client.put("/api/users/alice/board", json=board, headers=_auth(token))

    # Remove second item
    board["cards"][first_card_id]["checklist"] = [
        {"id": "item-1", "text": "Keep", "done": False},
    ]
    client.put("/api/users/alice/board", json=board, headers=_auth(token))

    r = client.get("/api/users/alice/board", headers=_auth(token))
    checklist = r.json()["board"]["cards"][first_card_id]["checklist"]
    assert len(checklist) == 1
    assert checklist[0]["text"] == "Keep"


def test_card_checklist_empty_by_default(client: TestClient) -> None:
    token = _register_and_login(client, "alice")
    r = client.get("/api/users/alice/board", headers=_auth(token))
    board = r.json()["board"]

    first_card_id = board["columns"][0]["cardIds"][0]
    checklist = board["cards"][first_card_id].get("checklist", [])
    assert checklist == []


def test_checklist_item_requires_text(client: TestClient) -> None:
    token = _register_and_login(client, "alice")
    r = client.get("/api/users/alice/board", headers=_auth(token))
    board = r.json()["board"]

    first_card_id = board["columns"][0]["cardIds"][0]
    board["cards"][first_card_id]["checklist"] = [
        {"id": "item-1", "text": "", "done": False},  # empty text should fail
    ]

    r = client.put("/api/users/alice/board", json=board, headers=_auth(token))
    assert r.status_code == 422


# ---------------------------------------------------------------------------
# Assignee fields
# ---------------------------------------------------------------------------

def test_card_with_assignee_ids_round_trips(client: TestClient) -> None:
    token = _register_and_login(client, "alice")
    r = client.get("/api/users/alice/board", headers=_auth(token))
    board = r.json()["board"]

    first_card_id = board["columns"][0]["cardIds"][0]
    board["cards"][first_card_id]["assignee_ids"] = ["alice", "bob"]

    r = client.put("/api/users/alice/board", json=board, headers=_auth(token))
    assert r.status_code == 200

    r = client.get("/api/users/alice/board", headers=_auth(token))
    saved = r.json()["board"]["cards"][first_card_id]["assignee_ids"]
    assert saved == ["alice", "bob"]


def test_card_assignee_ids_empty_by_default(client: TestClient) -> None:
    token = _register_and_login(client, "alice")
    r = client.get("/api/users/alice/board", headers=_auth(token))
    board = r.json()["board"]

    first_card_id = board["columns"][0]["cardIds"][0]
    assignees = board["cards"][first_card_id].get("assignee_ids", [])
    assert assignees == []


def test_card_assignee_ids_can_be_cleared(client: TestClient) -> None:
    token = _register_and_login(client, "alice")
    r = client.get("/api/users/alice/board", headers=_auth(token))
    board = r.json()["board"]

    first_card_id = board["columns"][0]["cardIds"][0]
    board["cards"][first_card_id]["assignee_ids"] = ["alice"]
    client.put("/api/users/alice/board", json=board, headers=_auth(token))

    board["cards"][first_card_id]["assignee_ids"] = []
    client.put("/api/users/alice/board", json=board, headers=_auth(token))

    r = client.get("/api/users/alice/board", headers=_auth(token))
    saved = r.json()["board"]["cards"][first_card_id]["assignee_ids"]
    assert saved == []


# ---------------------------------------------------------------------------
# Board stats with checklist
# ---------------------------------------------------------------------------

def test_board_stats_includes_checklist_fields(client: TestClient) -> None:
    token = _register_and_login(client, "alice")
    r = client.post("/api/users/alice/boards", json={"name": "Stats Board"}, headers=_auth(token))
    board_id = r.json()["id"]

    board = client.get(f"/api/users/alice/boards/{board_id}", headers=_auth(token)).json()["board"]
    first_card_id = board["columns"][0]["cardIds"][0]
    board["cards"][first_card_id]["checklist"] = [
        {"id": "item-1", "text": "Done item", "done": True},
        {"id": "item-2", "text": "Pending item", "done": False},
    ]
    client.put(f"/api/users/alice/boards/{board_id}", json=board, headers=_auth(token))

    r = client.get(f"/api/users/alice/boards/{board_id}/stats", headers=_auth(token))
    assert r.status_code == 200
    data = r.json()
    assert "checklist_items" in data
    assert "checklist_done" in data
    assert data["checklist_items"] >= 2
    assert data["checklist_done"] >= 1
