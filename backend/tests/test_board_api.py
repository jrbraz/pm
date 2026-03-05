import sys
from pathlib import Path

from fastapi.testclient import TestClient

# Ensure imports work both locally and in containerized test runs.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.main import create_app


def _client(tmp_path: Path) -> TestClient:
    fixture_dir = Path(__file__).resolve().parent / "fixtures" / "frontend_dist"
    db_path = tmp_path / "pm.db"
    return TestClient(create_app(frontend_dist_dir=fixture_dir, db_path=db_path))


def test_get_board_for_user_returns_default_board(tmp_path: Path) -> None:
    client = _client(tmp_path)

    response = client.get("/api/users/user/board")

    assert response.status_code == 200
    body = response.json()
    assert body["username"] == "user"
    assert len(body["board"]["columns"]) == 5
    assert "card-1" in body["board"]["cards"]
    assert body["board"]["cards"]["card-1"]["title"] == "Align roadmap themes"


def test_put_board_for_user_persists_and_returns_board(tmp_path: Path) -> None:
    client = _client(tmp_path)
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


def test_put_board_rejects_invalid_payload_with_consistent_error(tmp_path: Path) -> None:
    client = _client(tmp_path)
    invalid_payload = {
        "columns": [{"id": "col-backlog", "title": "Backlog", "cardIds": ["missing"]}],
        "cards": {},
    }

    response = client.put("/api/users/user/board", json=invalid_payload)

    assert response.status_code == 422
    assert response.json() == {
        "error": {"code": "VALIDATION_ERROR", "message": "Request validation failed."}
    }
