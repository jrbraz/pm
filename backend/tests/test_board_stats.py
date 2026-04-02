from fastapi.testclient import TestClient


def _setup_board_with_cards(client: TestClient, username: str) -> int:
    """Helper: creates a board with mixed priority cards. Returns board_id."""
    resp = client.post(f"/api/users/{username}/boards", json={"name": "Stats Test"})
    board_id = resp.json()["id"]

    payload = {
        "columns": [
            {"id": "col-todo", "title": "Todo", "cardIds": ["c1", "c2", "c3"]},
            {"id": "col-done", "title": "Done", "cardIds": ["c4"]},
        ],
        "cards": {
            "c1": {
                "id": "c1", "title": "Critical task", "details": "",
                "priority": "critical", "labels": ["urgent"], "due_date": "2020-01-01",
            },
            "c2": {
                "id": "c2", "title": "High task", "details": "",
                "priority": "high", "labels": [], "due_date": "2026-12-31",
            },
            "c3": {
                "id": "c3", "title": "Medium task", "details": "",
                "priority": "medium", "labels": ["feature"], "due_date": None,
            },
            "c4": {
                "id": "c4", "title": "No priority", "details": "",
                "priority": None, "labels": [], "due_date": None,
            },
        },
    }
    client.put(f"/api/users/{username}/boards/{board_id}", json=payload)
    return board_id


def test_get_board_stats_returns_correct_totals(auth_client) -> None:
    client, token, username = auth_client
    board_id = _setup_board_with_cards(client, username)
    resp = client.get(f"/api/users/{username}/boards/{board_id}/stats")
    assert resp.status_code == 200
    stats = resp.json()
    assert stats["total_cards"] == 4
    assert stats["total_columns"] == 2


def test_get_board_stats_priority_breakdown(auth_client) -> None:
    client, token, username = auth_client
    board_id = _setup_board_with_cards(client, username)
    stats = client.get(f"/api/users/{username}/boards/{board_id}/stats").json()
    assert stats["by_priority"]["critical"] == 1
    assert stats["by_priority"]["high"] == 1
    assert stats["by_priority"]["medium"] == 1
    assert stats["by_priority"]["none"] == 1


def test_get_board_stats_overdue_count(auth_client) -> None:
    client, token, username = auth_client
    board_id = _setup_board_with_cards(client, username)
    stats = client.get(f"/api/users/{username}/boards/{board_id}/stats").json()
    # c1 has due_date 2020-01-01 which is definitely in the past
    assert stats["overdue"] >= 1


def test_get_board_stats_by_column(auth_client) -> None:
    client, token, username = auth_client
    board_id = _setup_board_with_cards(client, username)
    stats = client.get(f"/api/users/{username}/boards/{board_id}/stats").json()
    assert stats["by_column"]["Todo"] == 3
    assert stats["by_column"]["Done"] == 1


def test_get_board_stats_nonexistent_board_returns_404(auth_client) -> None:
    client, token, username = auth_client
    resp = client.get(f"/api/users/{username}/boards/99999/stats")
    assert resp.status_code == 404


def test_card_edit_updates_priority_and_labels(auth_client) -> None:
    """Verify that editing a card via PUT preserves all fields correctly."""
    client, token, username = auth_client
    resp = client.post(f"/api/users/{username}/boards", json={"name": "Edit Test"})
    board_id = resp.json()["id"]

    initial_payload = {
        "columns": [{"id": "col-1", "title": "Work", "cardIds": ["c1"]}],
        "cards": {
            "c1": {
                "id": "c1", "title": "Old Title", "details": "Old details",
                "priority": "low", "labels": ["old"], "due_date": None,
            }
        },
    }
    client.put(f"/api/users/{username}/boards/{board_id}", json=initial_payload)

    # Edit the card
    updated_payload = {
        "columns": [{"id": "col-1", "title": "Work", "cardIds": ["c1"]}],
        "cards": {
            "c1": {
                "id": "c1", "title": "New Title", "details": "Updated details",
                "priority": "critical", "labels": ["new", "important"], "due_date": "2026-06-15",
            }
        },
    }
    put_resp = client.put(f"/api/users/{username}/boards/{board_id}", json=updated_payload)
    assert put_resp.status_code == 200
    card = put_resp.json()["board"]["cards"]["c1"]
    assert card["title"] == "New Title"
    assert card["priority"] == "critical"
    assert card["labels"] == ["new", "important"]
    assert card["due_date"] == "2026-06-15"


def test_delete_column_via_board_update(auth_client) -> None:
    """Simulating column deletion: updating board without a column removes it."""
    client, token, username = auth_client
    resp = client.post(f"/api/users/{username}/boards", json={"name": "Col Del Test"})
    board_id = resp.json()["id"]

    initial = {
        "columns": [
            {"id": "col-a", "title": "A", "cardIds": ["c1"]},
            {"id": "col-b", "title": "B", "cardIds": []},
        ],
        "cards": {"c1": {"id": "c1", "title": "T", "details": ""}},
    }
    client.put(f"/api/users/{username}/boards/{board_id}", json=initial)

    # Remove col-a + its card
    updated = {
        "columns": [{"id": "col-b", "title": "B", "cardIds": []}],
        "cards": {},
    }
    resp = client.put(f"/api/users/{username}/boards/{board_id}", json=updated)
    assert resp.status_code == 200
    board = resp.json()["board"]
    assert len(board["columns"]) == 1
    assert board["columns"][0]["id"] == "col-b"
    assert len(board["cards"]) == 0
