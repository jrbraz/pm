from fastapi.testclient import TestClient


def test_get_board_for_user_returns_default_board(client: TestClient) -> None:
    response = client.get("/api/users/user/board")

    assert response.status_code == 200
    body = response.json()
    assert body["username"] == "user"
    assert len(body["board"]["columns"]) == 5
    assert "card-1" in body["board"]["cards"]
    assert body["board"]["cards"]["card-1"]["title"] == "Align roadmap themes"


def test_put_board_for_user_persists_and_returns_board(client: TestClient) -> None:
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

    put_response = client.put("/api/users/user/board", json=payload)
    assert put_response.status_code == 200
    assert put_response.json()["board"] == payload

    get_response = client.get("/api/users/user/board")
    assert get_response.status_code == 200
    assert get_response.json()["board"] == payload


def test_put_board_rejects_invalid_payload_with_consistent_error(client: TestClient) -> None:
    invalid_payload = {
        "columns": [{"id": "col-backlog", "title": "Backlog", "cardIds": ["missing"]}],
        "cards": {},
    }

    response = client.put("/api/users/user/board", json=invalid_payload)

    assert response.status_code == 422
    assert response.json() == {
        "error": {"code": "VALIDATION_ERROR", "message": "Request validation failed."}
    }
