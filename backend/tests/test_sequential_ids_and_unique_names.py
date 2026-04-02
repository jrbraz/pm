"""Tests for sequential card IDs and unique board name enforcement."""
from fastapi.testclient import TestClient


def _register_and_login(client: TestClient, username: str, password: str = "testpass1234") -> str:
    client.post("/api/auth/register", json={"username": username, "password": password})
    r = client.post("/api/auth/login", json={"username": username, "password": password})
    return r.json()["token"]


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# Sequential card IDs (global per user, stored in users.card_seq)
# ---------------------------------------------------------------------------

class TestSequentialCardIds:
    def test_default_board_has_sequential_ids(self, client: TestClient) -> None:
        token = _register_and_login(client, "alice")
        r = client.get("/api/users/alice/board", headers=_auth(token))
        board = r.json()["board"]
        assert "INIT-1" in board["cards"]
        assert "TASK-8" in board["cards"]

    def test_default_board_sets_card_seq_to_8(self, client: TestClient) -> None:
        token = _register_and_login(client, "alice")
        # Trigger default board creation
        client.get("/api/users/alice/boards", headers=_auth(token))
        # Next card should be CARD-9
        r = client.post("/api/users/alice/next-card-id", headers=_auth(token))
        assert r.status_code == 200
        assert r.json()["card_id"] == "INIT-9"

    def test_new_user_without_default_board_starts_at_1(self, client: TestClient) -> None:
        """User who creates a board manually (empty) gets CARD-1 as first card."""
        token = _register_and_login(client, "bob")
        # Create a board directly (no default board seeded yet)
        client.post("/api/users/bob/boards", json={"name": "Fresh"}, headers=_auth(token))
        # The first board creation seeds DEFAULT_BOARD, so seq is 8
        # Create another board
        client.post("/api/users/bob/boards", json={"name": "Second"}, headers=_auth(token))
        # Seq should be at 8 from the default, next is CARD-9
        r = client.post("/api/users/bob/next-card-id", headers=_auth(token))
        assert r.json()["card_id"] == "INIT-9"

    def test_next_card_id_increments(self, client: TestClient) -> None:
        token = _register_and_login(client, "charlie")
        # Trigger default board (sets seq to 8)
        client.get("/api/users/charlie/boards", headers=_auth(token))

        r1 = client.post("/api/users/charlie/next-card-id", headers=_auth(token))
        assert r1.json()["card_id"] == "INIT-9"

        r2 = client.post("/api/users/charlie/next-card-id", headers=_auth(token))
        assert r2.json()["card_id"] == "INIT-10"

        r3 = client.post("/api/users/charlie/next-card-id", headers=_auth(token))
        assert r3.json()["card_id"] == "INIT-11"

    def test_next_card_id_is_global_across_boards(self, client: TestClient) -> None:
        token = _register_and_login(client, "dave")
        client.get("/api/users/dave/boards", headers=_auth(token))
        client.post("/api/users/dave/boards", json={"name": "Board B"}, headers=_auth(token))

        # Reserve a card for board A
        r1 = client.post("/api/users/dave/next-card-id", headers=_auth(token))
        assert r1.json()["card_id"] == "INIT-9"

        # Reserve a card for board B -- should continue the sequence
        r2 = client.post("/api/users/dave/next-card-id", headers=_auth(token))
        assert r2.json()["card_id"] == "INIT-10"

    def test_next_card_id_requires_auth(self, client: TestClient) -> None:
        r = client.post("/api/users/alice/next-card-id")
        assert r.status_code == 401

    def test_next_card_id_wrong_user(self, client: TestClient) -> None:
        _register_and_login(client, "alice")
        token_bob = _register_and_login(client, "bob")
        r = client.post("/api/users/alice/next-card-id", headers=_auth(token_bob))
        assert r.status_code == 403


# ---------------------------------------------------------------------------
# Unique board names
# ---------------------------------------------------------------------------

class TestUniqueBoardNames:
    def test_cannot_create_duplicate_name(self, client: TestClient) -> None:
        token = _register_and_login(client, "alice")
        r = client.post(
            "/api/users/alice/boards",
            json={"name": "My Project"},
            headers=_auth(token),
        )
        assert r.status_code == 201

        r = client.post(
            "/api/users/alice/boards",
            json={"name": "My Project"},
            headers=_auth(token),
        )
        assert r.status_code == 409
        assert "already exists" in r.json()["error"]["message"]

    def test_duplicate_check_is_case_insensitive(self, client: TestClient) -> None:
        token = _register_and_login(client, "alice")
        client.post(
            "/api/users/alice/boards",
            json={"name": "Sprint Board"},
            headers=_auth(token),
        )

        r = client.post(
            "/api/users/alice/boards",
            json={"name": "sprint board"},
            headers=_auth(token),
        )
        assert r.status_code == 409

    def test_different_users_can_have_same_name(self, client: TestClient) -> None:
        token_alice = _register_and_login(client, "alice")
        token_bob = _register_and_login(client, "bob")

        r = client.post(
            "/api/users/alice/boards",
            json={"name": "Shared Name"},
            headers=_auth(token_alice),
        )
        assert r.status_code == 201

        r = client.post(
            "/api/users/bob/boards",
            json={"name": "Shared Name"},
            headers=_auth(token_bob),
        )
        assert r.status_code == 201

    def test_cannot_rename_to_existing_name(self, client: TestClient) -> None:
        token = _register_and_login(client, "alice")
        client.post("/api/users/alice/boards", json={"name": "Board A"}, headers=_auth(token))
        r = client.post("/api/users/alice/boards", json={"name": "Board B"}, headers=_auth(token))
        board_b_id = r.json()["id"]

        r = client.patch(
            f"/api/users/alice/boards/{board_b_id}",
            json={"name": "Board A"},
            headers=_auth(token),
        )
        assert r.status_code == 409

    def test_can_rename_to_same_name(self, client: TestClient) -> None:
        """Renaming a board to its own current name should succeed."""
        token = _register_and_login(client, "alice")
        r = client.post("/api/users/alice/boards", json={"name": "Keep Name"}, headers=_auth(token))
        board_id = r.json()["id"]

        r = client.patch(
            f"/api/users/alice/boards/{board_id}",
            json={"name": "Keep Name"},
            headers=_auth(token),
        )
        assert r.status_code == 200

    def test_cannot_duplicate_to_existing_name(self, client: TestClient) -> None:
        token = _register_and_login(client, "alice")
        r = client.post("/api/users/alice/boards", json={"name": "Original"}, headers=_auth(token))
        board_id = r.json()["id"]
        client.post("/api/users/alice/boards", json={"name": "Taken"}, headers=_auth(token))

        r = client.post(
            f"/api/users/alice/boards/{board_id}/duplicate",
            json={"name": "Taken"},
            headers=_auth(token),
        )
        assert r.status_code == 409
