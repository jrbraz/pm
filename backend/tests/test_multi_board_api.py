from fastapi.testclient import TestClient


def test_list_boards_creates_default(client: TestClient) -> None:
    response = client.get("/api/users/user/boards")
    assert response.status_code == 200
    body = response.json()
    assert body["username"] == "user"
    assert len(body["boards"]) == 1
    assert body["boards"][0]["name"] == "My Board"
    assert body["boards"][0]["is_default"] is True


def test_create_board_returns_201(client: TestClient) -> None:
    response = client.post("/api/users/user/boards", json={"name": "Sprint 1"})
    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Sprint 1"
    assert body["username"] == "user"
    assert "board" in body


def test_create_multiple_boards(client: TestClient) -> None:
    client.post("/api/users/user/boards", json={"name": "Board A"})
    client.post("/api/users/user/boards", json={"name": "Board B"})
    response = client.get("/api/users/user/boards")
    assert response.status_code == 200
    assert len(response.json()["boards"]) == 2
    names = [b["name"] for b in response.json()["boards"]]
    assert "Board A" in names
    assert "Board B" in names


def test_get_specific_board(client: TestClient) -> None:
    create_resp = client.post("/api/users/user/boards", json={"name": "My Sprint"})
    board_id = create_resp.json()["id"]

    response = client.get(f"/api/users/user/boards/{board_id}")
    assert response.status_code == 200
    body = response.json()
    assert body["id"] == board_id
    assert body["name"] == "My Sprint"
    assert "board" in body


def test_get_nonexistent_board_returns_404(client: TestClient) -> None:
    response = client.get("/api/users/user/boards/99999")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "NOT_FOUND"


def test_put_specific_board_saves_data(client: TestClient) -> None:
    create_resp = client.post("/api/users/user/boards", json={"name": "Test Board"})
    board_id = create_resp.json()["id"]

    payload = {
        "columns": [{"id": "col-1", "title": "Todo", "cardIds": ["c-1"]}],
        "cards": {"c-1": {"id": "c-1", "title": "Task", "details": "Do it"}},
    }
    put_resp = client.put(f"/api/users/user/boards/{board_id}", json=payload)
    assert put_resp.status_code == 200
    assert put_resp.json()["board"]["cards"]["c-1"]["title"] == "Task"

    get_resp = client.get(f"/api/users/user/boards/{board_id}")
    assert get_resp.json()["board"]["cards"]["c-1"]["title"] == "Task"


def test_rename_board(client: TestClient) -> None:
    create_resp = client.post("/api/users/user/boards", json={"name": "Old Name"})
    board_id = create_resp.json()["id"]

    patch_resp = client.patch(f"/api/users/user/boards/{board_id}", json={"name": "New Name"})
    assert patch_resp.status_code == 200
    assert patch_resp.json()["name"] == "New Name"

    get_resp = client.get(f"/api/users/user/boards/{board_id}")
    assert get_resp.json()["name"] == "New Name"


def test_delete_board(client: TestClient) -> None:
    create_resp = client.post("/api/users/user/boards", json={"name": "To Delete"})
    board_id = create_resp.json()["id"]

    del_resp = client.delete(f"/api/users/user/boards/{board_id}")
    assert del_resp.status_code == 204

    get_resp = client.get(f"/api/users/user/boards/{board_id}")
    assert get_resp.status_code == 404


def test_boards_are_isolated_per_user(client: TestClient) -> None:
    client.post("/api/users/alice/boards", json={"name": "Alice Board"})
    client.post("/api/users/bob/boards", json={"name": "Bob Board"})

    alice_boards = client.get("/api/users/alice/boards").json()["boards"]
    bob_boards = client.get("/api/users/bob/boards").json()["boards"]

    alice_names = [b["name"] for b in alice_boards]
    bob_names = [b["name"] for b in bob_boards]

    assert "Alice Board" in alice_names
    assert "Alice Board" not in bob_names
    assert "Bob Board" in bob_names
    assert "Bob Board" not in alice_names


def test_create_board_empty_name_returns_400(client: TestClient) -> None:
    response = client.post("/api/users/user/boards", json={"name": "   "})
    assert response.status_code == 400


def test_board_supports_card_with_priority_and_labels(client: TestClient) -> None:
    create_resp = client.post("/api/users/user/boards", json={"name": "Enhanced"})
    board_id = create_resp.json()["id"]

    payload = {
        "columns": [{"id": "col-1", "title": "Todo", "cardIds": ["c-1"]}],
        "cards": {
            "c-1": {
                "id": "c-1",
                "title": "Task",
                "details": "Details",
                "priority": "high",
                "labels": ["backend", "urgent"],
                "due_date": "2026-05-01",
            }
        },
    }
    put_resp = client.put(f"/api/users/user/boards/{board_id}", json=payload)
    assert put_resp.status_code == 200
    card = put_resp.json()["board"]["cards"]["c-1"]
    assert card["priority"] == "high"
    assert card["labels"] == ["backend", "urgent"]
    assert card["due_date"] == "2026-05-01"
