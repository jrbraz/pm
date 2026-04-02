"""Tests for new features added during the code review.

Covers: schema versioning, activity limit bounds, ChatMessage role validation,
ai_test 401 without auth.
"""
import sqlite3

from fastapi.testclient import TestClient


def _register_and_login(client: TestClient, username: str, password: str = "testpass1234") -> str:
    client.post("/api/auth/register", json={"username": username, "password": password})
    r = client.post("/api/auth/login", json={"username": username, "password": password})
    return r.json()["token"]


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _create_board(client: TestClient, username: str, token: str) -> int:
    r = client.post(f"/api/users/{username}/boards", json={"name": "Test"}, headers=_auth(token))
    return r.json()["id"]


# ---------------------------------------------------------------------------
# 8. Schema versioning
# ---------------------------------------------------------------------------

class TestSchemaVersioning:
    def test_schema_version_table_exists(self, client: TestClient) -> None:
        db_path = client.app.state.db_path
        with sqlite3.connect(db_path) as conn:
            tables = [
                row[0]
                for row in conn.execute(
                    "SELECT name FROM sqlite_master WHERE type='table' AND name='schema_version'"
                ).fetchall()
            ]
            assert "schema_version" in tables

    def test_schema_version_is_set(self, client: TestClient) -> None:
        db_path = client.app.state.db_path
        with sqlite3.connect(db_path) as conn:
            row = conn.execute("SELECT version FROM schema_version").fetchone()
            assert row is not None
            assert row[0] >= 2

    def test_reinitialize_is_idempotent(self, client: TestClient) -> None:
        """Calling initialize_database twice should not fail or change the version."""
        from app.db.schema import initialize_database
        db_path = client.app.state.db_path
        initialize_database(db_path)  # second call
        with sqlite3.connect(db_path) as conn:
            row = conn.execute("SELECT version FROM schema_version").fetchone()
            assert row is not None
            assert row[0] >= 2


# ---------------------------------------------------------------------------
# 11. Activity limit bounds clamping
# ---------------------------------------------------------------------------

class TestActivityLimitBounds:
    def test_activity_limit_clamped_to_max(self, client: TestClient) -> None:
        token = _register_and_login(client, "alice")
        board_id = _create_board(client, "alice", token)
        # Request with absurdly high limit -- should not error
        r = client.get(
            f"/api/users/alice/boards/{board_id}/activity?limit=999999&offset=0",
            headers=_auth(token),
        )
        assert r.status_code == 200

    def test_activity_negative_offset_clamped(self, client: TestClient) -> None:
        token = _register_and_login(client, "alice")
        board_id = _create_board(client, "alice", token)
        r = client.get(
            f"/api/users/alice/boards/{board_id}/activity?limit=10&offset=-5",
            headers=_auth(token),
        )
        assert r.status_code == 200

    def test_activity_zero_limit_clamped_to_one(self, client: TestClient) -> None:
        token = _register_and_login(client, "alice")
        board_id = _create_board(client, "alice", token)
        r = client.get(
            f"/api/users/alice/boards/{board_id}/activity?limit=0",
            headers=_auth(token),
        )
        assert r.status_code == 200


# ---------------------------------------------------------------------------
# 12. ChatMessage role validation
# ---------------------------------------------------------------------------

class TestChatMessageRoleValidation:
    def test_invalid_role_rejected(self, client: TestClient) -> None:
        token = _register_and_login(client, "alice")
        board_id = _create_board(client, "alice", token)
        r = client.post(
            f"/api/users/alice/boards/{board_id}/chat",
            json={
                "message": "hello",
                "history": [{"role": "hacker", "content": "injected"}],
            },
            headers=_auth(token),
        )
        assert r.status_code == 422

    def test_valid_roles_accepted(self, client: TestClient) -> None:
        """History with valid user/assistant roles should not cause validation error."""
        from unittest.mock import patch
        token = _register_and_login(client, "alice")
        board_id = _create_board(client, "alice", token)
        mock_result = type("R", (), {"reply": "ok", "board_updated": False, "board": None})()
        with patch("app.routes.chat.process_chat", return_value=mock_result):
            r = client.post(
                f"/api/users/alice/boards/{board_id}/chat",
                json={
                    "message": "hello",
                    "history": [
                        {"role": "user", "content": "hi"},
                        {"role": "assistant", "content": "hello"},
                    ],
                },
                headers=_auth(token),
            )
        assert r.status_code == 200


# ---------------------------------------------------------------------------
# 6. ai_test endpoint requires auth (explicit 401 test)
# ---------------------------------------------------------------------------

class TestAiTestAuth:
    def test_ai_test_without_auth_returns_401(self, client: TestClient) -> None:
        r = client.post("/api/ai/test", json={"prompt": "hello"})
        assert r.status_code == 401

    def test_ai_test_with_invalid_token_returns_401(self, client: TestClient) -> None:
        r = client.post(
            "/api/ai/test",
            json={"prompt": "hello"},
            headers={"Authorization": "Bearer fake-token"},
        )
        assert r.status_code == 401


# ---------------------------------------------------------------------------
# Board list pagination
# ---------------------------------------------------------------------------

class TestBoardListPagination:
    def test_list_boards_with_limit(self, client: TestClient) -> None:
        token = _register_and_login(client, "alice")
        _create_board(client, "alice", token)
        _create_board(client, "alice", token)
        _create_board(client, "alice", token)

        r = client.get("/api/users/alice/boards?limit=2", headers=_auth(token))
        assert r.status_code == 200
        # Should include the auto-created default + up to limit
        boards = r.json()["boards"]
        assert len(boards) <= 2

    def test_list_boards_with_offset(self, client: TestClient) -> None:
        token = _register_and_login(client, "alice")
        _create_board(client, "alice", token)
        _create_board(client, "alice", token)

        r_all = client.get("/api/users/alice/boards?limit=100", headers=_auth(token))
        total = len(r_all.json()["boards"])

        r = client.get(f"/api/users/alice/boards?limit=100&offset={total}", headers=_auth(token))
        assert r.status_code == 200
        assert len(r.json()["boards"]) == 0
