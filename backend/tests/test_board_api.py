from fastapi.testclient import TestClient


def test_get_board_for_user_returns_default_board(auth_client) -> None:
    client, token, username = auth_client
    response = client.get(f"/api/users/{username}/board")

    assert response.status_code == 200
    body = response.json()
    assert body["username"] == username
    assert len(body["board"]["columns"]) == 5
    assert "CARD-1" in body["board"]["cards"]
    assert body["board"]["cards"]["CARD-1"]["title"] == "Align roadmap themes"


def test_put_board_for_user_persists_and_returns_board(auth_client) -> None:
    client, token, username = auth_client
    payload = {
        "columns": [
            {"id": "col-backlog", "title": "Backlog", "cardIds": ["card-1"]},
            {"id": "col-done", "title": "Done", "cardIds": []},
        ],
        "cards": {
            "card-1": {
                "id": "card-1",
                "title": "API task",
                "details": "Saved from API",
            }
        },
    }

    put_response = client.put(f"/api/users/{username}/board", json=payload)
    assert put_response.status_code == 200
    board = put_response.json()["board"]
    assert board["columns"] == payload["columns"]
    assert board["cards"]["card-1"]["title"] == "API task"
    assert board["cards"]["card-1"]["details"] == "Saved from API"

    get_response = client.get(f"/api/users/{username}/board")
    assert get_response.status_code == 200
    get_board = get_response.json()["board"]
    assert get_board["cards"]["card-1"]["title"] == "API task"


def test_put_board_rejects_invalid_payload_with_consistent_error(auth_client) -> None:
    client, token, username = auth_client
    invalid_payload = {
        "columns": [{"id": "col-backlog", "title": "Backlog", "cardIds": ["missing"]}],
        "cards": {},
    }

    response = client.put(f"/api/users/{username}/board", json=invalid_payload)

    assert response.status_code == 422
    assert response.json() == {
        "error": {"code": "VALIDATION_ERROR", "message": "Request validation failed."}
    }
