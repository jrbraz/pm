"""Tests targeting coverage gaps to reach 90%+ overall coverage.

Covers: routes/chat.py (board-scoped chat), board_service.py (named board funcs),
db/users.py (get_user_by_id, search), db/sessions.py (cleanup), auth.py (edge cases),
deps.py (optional auth, board access), routes/users.py (search, change-password edge cases).
"""
import json
from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _register_and_login(client: TestClient, username: str, password: str = "testpass1234") -> str:
    client.post("/api/auth/register", json={"username": username, "password": password})
    r = client.post("/api/auth/login", json={"username": username, "password": password})
    return r.json()["token"]


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _create_board(client: TestClient, username: str, token: str, name: str = "Test Board") -> int:
    r = client.post(f"/api/users/{username}/boards", json={"name": name}, headers=_auth(token))
    assert r.status_code == 201
    return r.json()["id"]


# ---------------------------------------------------------------------------
# routes/chat.py -- board-scoped chat endpoint
# ---------------------------------------------------------------------------

class TestBoardScopedChat:
    """Cover the /users/{username}/boards/{board_id}/chat endpoint (lines 82-109)."""

    def test_chat_for_board_forbidden_wrong_user(self, client: TestClient) -> None:
        token_alice = _register_and_login(client, "alice")
        _register_and_login(client, "bob")
        board_id = _create_board(client, "alice", token_alice)
        token_bob = _register_and_login(client, "bob2", "bobpass1234")

        r = client.post(
            f"/api/users/alice/boards/{board_id}/chat",
            json={"message": "hello"},
            headers=_auth(token_bob),
        )
        assert r.status_code == 403

    def test_chat_for_board_empty_message(self, client: TestClient) -> None:
        token = _register_and_login(client, "alice")
        board_id = _create_board(client, "alice", token)

        r = client.post(
            f"/api/users/alice/boards/{board_id}/chat",
            json={"message": ""},
            headers=_auth(token),
        )
        assert r.status_code == 400

    def test_chat_for_board_not_found(self, client: TestClient) -> None:
        token = _register_and_login(client, "alice")

        r = client.post(
            f"/api/users/alice/boards/99999/chat",
            json={"message": "hello"},
            headers=_auth(token),
        )
        assert r.status_code == 404

    def test_chat_for_board_success(self, client: TestClient) -> None:
        token = _register_and_login(client, "alice")
        board_id = _create_board(client, "alice", token)

        mock_result = type("R", (), {"reply": "Done!", "board_updated": False, "board": None})()
        with patch("app.routes.chat.process_chat", return_value=mock_result):
            r = client.post(
                f"/api/users/alice/boards/{board_id}/chat",
                json={"message": "add a card"},
                headers=_auth(token),
            )
        assert r.status_code == 200
        assert r.json()["reply"] == "Done!"
        assert r.json()["board_updated"] is False

    def test_chat_for_board_with_board_update(self, client: TestClient) -> None:
        token = _register_and_login(client, "alice")
        board_id = _create_board(client, "alice", token)

        # Get the current board data
        board_resp = client.get(f"/api/users/alice/boards/{board_id}", headers=_auth(token))
        board_data = board_resp.json()["board"]

        from app.board_models import BoardData
        updated_board = BoardData.model_validate(board_data)

        mock_result = type("R", (), {
            "reply": "Updated!",
            "board_updated": True,
            "board": updated_board,
        })()
        with patch("app.routes.chat.process_chat", return_value=mock_result):
            r = client.post(
                f"/api/users/alice/boards/{board_id}/chat",
                json={"message": "move a card"},
                headers=_auth(token),
            )
        assert r.status_code == 200
        assert r.json()["board_updated"] is True

    def test_chat_for_board_ai_error(self, client: TestClient) -> None:
        token = _register_and_login(client, "alice")
        board_id = _create_board(client, "alice", token)

        with patch("app.routes.chat.process_chat", side_effect=RuntimeError("AI down")):
            r = client.post(
                f"/api/users/alice/boards/{board_id}/chat",
                json={"message": "hello"},
                headers=_auth(token),
            )
        assert r.status_code == 502

    def test_legacy_chat_forbidden_wrong_user(self, client: TestClient) -> None:
        _register_and_login(client, "alice")
        token_bob = _register_and_login(client, "bob")

        r = client.post(
            "/api/users/alice/chat",
            json={"message": "hello"},
            headers=_auth(token_bob),
        )
        assert r.status_code == 403


# ---------------------------------------------------------------------------
# board_service.py -- named board functions
# ---------------------------------------------------------------------------

class TestBoardServiceViaAPI:
    """Cover board_service named board lookups and edge cases."""

    def test_get_named_board_not_found(self, client: TestClient) -> None:
        token = _register_and_login(client, "alice")
        r = client.get("/api/users/alice/boards/99999", headers=_auth(token))
        assert r.status_code == 404

    def test_put_named_board_not_found(self, client: TestClient) -> None:
        token = _register_and_login(client, "alice")
        board_data = {"columns": [], "cards": {}}
        r = client.put(
            "/api/users/alice/boards/99999",
            json=board_data,
            headers=_auth(token),
        )
        assert r.status_code == 404

    def test_rename_board_not_found(self, client: TestClient) -> None:
        token = _register_and_login(client, "alice")
        r = client.patch(
            "/api/users/alice/boards/99999",
            json={"name": "New Name"},
            headers=_auth(token),
        )
        assert r.status_code == 404

    def test_rename_board_empty_name(self, client: TestClient) -> None:
        token = _register_and_login(client, "alice")
        board_id = _create_board(client, "alice", token)
        r = client.patch(
            f"/api/users/alice/boards/{board_id}",
            json={"name": "  "},
            headers=_auth(token),
        )
        assert r.status_code == 400

    def test_delete_board_not_found(self, client: TestClient) -> None:
        token = _register_and_login(client, "alice")
        r = client.delete("/api/users/alice/boards/99999", headers=_auth(token))
        assert r.status_code == 404

    def test_duplicate_board_not_found(self, client: TestClient) -> None:
        token = _register_and_login(client, "alice")
        r = client.post(
            "/api/users/alice/boards/99999/duplicate",
            json={"name": "Copy"},
            headers=_auth(token),
        )
        assert r.status_code == 404

    def test_duplicate_board_empty_name(self, client: TestClient) -> None:
        token = _register_and_login(client, "alice")
        board_id = _create_board(client, "alice", token)
        r = client.post(
            f"/api/users/alice/boards/{board_id}/duplicate",
            json={"name": ""},
            headers=_auth(token),
        )
        assert r.status_code == 400

    def test_board_stats_not_found(self, client: TestClient) -> None:
        token = _register_and_login(client, "alice")
        r = client.get("/api/users/alice/boards/99999/stats", headers=_auth(token))
        assert r.status_code == 404


# ---------------------------------------------------------------------------
# db/users.py -- get_user_by_id, search_users
# ---------------------------------------------------------------------------

class TestDbUsers:
    def test_get_user_by_id_returns_user(self, client: TestClient) -> None:
        from app.db import get_user_by_id, get_or_create_user_id
        db_path = client.app.state.db_path
        user_id = get_or_create_user_id(db_path, "findme")
        result = get_user_by_id(db_path, user_id)
        assert result is not None
        assert result["username"] == "findme"

    def test_get_user_by_id_not_found(self, client: TestClient) -> None:
        from app.db import get_user_by_id
        db_path = client.app.state.db_path
        assert get_user_by_id(db_path, 999999) is None

    def test_search_users_returns_matches(self, client: TestClient) -> None:
        from app.db import search_users, get_or_create_user_id
        db_path = client.app.state.db_path
        get_or_create_user_id(db_path, "searchable_alice")
        get_or_create_user_id(db_path, "searchable_bob")
        results = search_users(db_path, "searchable_")
        assert len(results) == 2

    def test_search_users_no_match(self, client: TestClient) -> None:
        from app.db import search_users
        db_path = client.app.state.db_path
        results = search_users(db_path, "zzz_nonexistent_")
        assert results == []


# ---------------------------------------------------------------------------
# db/sessions.py -- cleanup_expired_sessions with Path
# ---------------------------------------------------------------------------

class TestSessionCleanup:
    def test_cleanup_with_path(self, client: TestClient) -> None:
        from app.db import cleanup_expired_sessions
        db_path = client.app.state.db_path
        deleted = cleanup_expired_sessions(db_path)
        assert isinstance(deleted, int)


# ---------------------------------------------------------------------------
# db/boards.py -- BoardConflictError
# ---------------------------------------------------------------------------

class TestOptimisticLocking:
    def test_update_board_json_conflict(self, client: TestClient) -> None:
        from app.db import (
            BoardConflictError,
            create_board,
            get_or_create_user_id,
            update_board_json,
        )
        db_path = client.app.state.db_path
        user_id = get_or_create_user_id(db_path, "locker")
        board_id = create_board(db_path, user_id, "Lock Test", '{"columns":[],"cards":{}}')

        with pytest.raises(BoardConflictError):
            update_board_json(db_path, board_id, user_id, '{"columns":[],"cards":{}}',
                              expected_updated_at="1999-01-01 00:00:00")

    def test_update_board_json_by_id_conflict(self, client: TestClient) -> None:
        from app.db import (
            BoardConflictError,
            create_board,
            get_or_create_user_id,
            update_board_json_by_id,
        )
        db_path = client.app.state.db_path
        user_id = get_or_create_user_id(db_path, "locker2")
        board_id = create_board(db_path, user_id, "Lock Test 2", '{"columns":[],"cards":{}}')

        with pytest.raises(BoardConflictError):
            update_board_json_by_id(db_path, board_id, '{"columns":[],"cards":{}}',
                                    expected_updated_at="1999-01-01 00:00:00")


# ---------------------------------------------------------------------------
# auth.py -- edge cases
# ---------------------------------------------------------------------------

class TestAuthEdgeCases:
    def test_login_no_password_hash_rejects(self, client: TestClient) -> None:
        """Legacy user without password_hash cannot log in."""
        from app.db import get_or_create_user_id
        db_path = client.app.state.db_path
        get_or_create_user_id(db_path, "legacy_user")

        r = client.post("/api/auth/login", json={"username": "legacy_user", "password": "anything1"})
        assert r.status_code == 401

    def test_login_wrong_password(self, client: TestClient) -> None:
        _register_and_login(client, "alice")
        r = client.post("/api/auth/login", json={"username": "alice", "password": "wrongpass1"})
        assert r.status_code == 401

    def test_login_nonexistent_user(self, client: TestClient) -> None:
        r = client.post("/api/auth/login", json={"username": "nobody", "password": "pass12345"})
        assert r.status_code == 401

    def test_register_short_username(self, client: TestClient) -> None:
        r = client.post("/api/auth/register", json={"username": "a", "password": "pass12345"})
        assert r.status_code == 400

    def test_register_short_password(self, client: TestClient) -> None:
        r = client.post("/api/auth/register", json={"username": "validuser", "password": "short"})
        assert r.status_code == 400

    def test_validate_token_expired(self, client: TestClient) -> None:
        """Expired token should return None and be deleted."""
        from app.auth import validate_token
        from app.db import create_session, get_or_create_user_id
        db_path = client.app.state.db_path
        user_id = get_or_create_user_id(db_path, "expired_user")
        create_session(db_path, user_id, "expired-token-123", "2000-01-01T00:00:00+00:00")
        result = validate_token(db_path, "expired-token-123")
        assert result is None

    def test_validate_token_empty(self, client: TestClient) -> None:
        from app.auth import validate_token
        db_path = client.app.state.db_path
        assert validate_token(db_path, "") is None

    def test_validate_token_nonexistent(self, client: TestClient) -> None:
        from app.auth import validate_token
        db_path = client.app.state.db_path
        assert validate_token(db_path, "nonexistent-token") is None

    def test_verify_password_invalid_hash_format(self) -> None:
        from app.auth import verify_password
        assert verify_password("test", "invalid-no-colon") is False


# ---------------------------------------------------------------------------
# deps.py -- get_current_user_optional, require_board_access
# ---------------------------------------------------------------------------

class TestDeps:
    def test_no_auth_header_returns_401(self, client: TestClient) -> None:
        r = client.get("/api/users/alice/boards")
        assert r.status_code == 401

    def test_invalid_token_returns_401(self, client: TestClient) -> None:
        r = client.get("/api/users/alice/boards", headers={"Authorization": "Bearer invalid-token"})
        assert r.status_code == 401

    def test_board_access_insufficient_role(self, client: TestClient) -> None:
        alice_token = _register_and_login(client, "alice")
        charlie_token = _register_and_login(client, "charlie")
        board_id = _create_board(client, "alice", alice_token)

        # Add charlie as viewer
        client.post(
            f"/api/users/alice/boards/{board_id}/members",
            json={"username": "charlie", "role": "viewer"},
            headers=_auth(alice_token),
        )
        # Viewer tries to save board -- should get 403
        board_data = {"columns": [], "cards": {}}
        r = client.put(
            f"/api/users/alice/boards/{board_id}",
            json=board_data,
            headers=_auth(charlie_token),
        )
        assert r.status_code == 403


# ---------------------------------------------------------------------------
# routes/users.py -- search, change-password edge cases
# ---------------------------------------------------------------------------

class TestUsersRoute:
    def test_search_users_requires_auth(self, client: TestClient) -> None:
        r = client.get("/api/users/search?q=test")
        assert r.status_code == 401

    def test_search_users_empty_query(self, client: TestClient) -> None:
        token = _register_and_login(client, "alice")
        r = client.get("/api/users/search?q=", headers=_auth(token))
        assert r.status_code == 200
        assert r.json() == []

    def test_search_users_returns_results(self, client: TestClient) -> None:
        token = _register_and_login(client, "alice")
        _register_and_login(client, "alice2", "pass22223333")
        r = client.get("/api/users/search?q=alice", headers=_auth(token))
        assert r.status_code == 200
        usernames = [u["username"] for u in r.json()]
        assert "alice" in usernames
        assert "alice2" in usernames

    def test_get_profile_not_found(self, client: TestClient) -> None:
        r = client.get("/api/users/nobody/profile")
        assert r.status_code == 404

    def test_get_profile_found(self, client: TestClient) -> None:
        _register_and_login(client, "alice")
        r = client.get("/api/users/alice/profile")
        assert r.status_code == 200
        data = r.json()
        assert data["username"] == "alice"
        assert data["has_password"] is True

    def test_change_password_user_not_found(self, client: TestClient) -> None:
        r = client.post(
            "/api/users/nobody/change-password",
            json={"current_password": "old12345", "new_password": "new12345"},
        )
        assert r.status_code == 404

    def test_change_password_wrong_current(self, client: TestClient) -> None:
        _register_and_login(client, "alice")
        r = client.post(
            "/api/users/alice/change-password",
            json={"current_password": "wrongpass1", "new_password": "newpass12"},
        )
        assert r.status_code == 401

    def test_change_password_too_short_new(self, client: TestClient) -> None:
        _register_and_login(client, "alice")
        r = client.post(
            "/api/users/alice/change-password",
            json={"current_password": "testpass1234", "new_password": "short"},
        )
        assert r.status_code == 400

    def test_change_password_no_hash_rejects(self, client: TestClient) -> None:
        """Legacy user without password hash cannot change password."""
        from app.db import get_or_create_user_id
        db_path = client.app.state.db_path
        get_or_create_user_id(db_path, "legacy")
        r = client.post(
            "/api/users/legacy/change-password",
            json={"current_password": "anything1", "new_password": "newpass12"},
        )
        assert r.status_code == 401

    def test_change_password_success(self, client: TestClient) -> None:
        _register_and_login(client, "alice")
        r = client.post(
            "/api/users/alice/change-password",
            json={"current_password": "testpass1234", "new_password": "brandnew1234"},
        )
        assert r.status_code == 200
        # Verify new password works
        r = client.post("/api/auth/login", json={"username": "alice", "password": "brandnew1234"})
        assert r.status_code == 200


# ---------------------------------------------------------------------------
# routes/board.py -- username mismatch edge cases
# ---------------------------------------------------------------------------

class TestBoardUsernameChecks:
    def test_legacy_get_board_wrong_user(self, client: TestClient) -> None:
        _register_and_login(client, "alice")
        token_bob = _register_and_login(client, "bob")
        r = client.get("/api/users/alice/board", headers=_auth(token_bob))
        assert r.status_code == 403

    def test_legacy_put_board_wrong_user(self, client: TestClient) -> None:
        _register_and_login(client, "alice")
        token_bob = _register_and_login(client, "bob")
        r = client.put(
            "/api/users/alice/board",
            json={"columns": [], "cards": {}},
            headers=_auth(token_bob),
        )
        assert r.status_code == 403

    def test_list_boards_wrong_user(self, client: TestClient) -> None:
        _register_and_login(client, "alice")
        token_bob = _register_and_login(client, "bob")
        r = client.get("/api/users/alice/boards", headers=_auth(token_bob))
        assert r.status_code == 403

    def test_create_board_wrong_user(self, client: TestClient) -> None:
        _register_and_login(client, "alice")
        token_bob = _register_and_login(client, "bob")
        r = client.post(
            "/api/users/alice/boards",
            json={"name": "Hacked"},
            headers=_auth(token_bob),
        )
        assert r.status_code == 403

    def test_delete_board_wrong_user(self, client: TestClient) -> None:
        token_alice = _register_and_login(client, "alice")
        token_bob = _register_and_login(client, "bob")
        board_id = _create_board(client, "alice", token_alice)
        r = client.delete(
            f"/api/users/alice/boards/{board_id}",
            headers=_auth(token_bob),
        )
        assert r.status_code == 403

    def test_rename_board_wrong_user(self, client: TestClient) -> None:
        token_alice = _register_and_login(client, "alice")
        token_bob = _register_and_login(client, "bob")
        board_id = _create_board(client, "alice", token_alice)
        r = client.patch(
            f"/api/users/alice/boards/{board_id}",
            json={"name": "Hacked"},
            headers=_auth(token_bob),
        )
        assert r.status_code == 403

    def test_duplicate_board_wrong_user(self, client: TestClient) -> None:
        token_alice = _register_and_login(client, "alice")
        token_bob = _register_and_login(client, "bob")
        board_id = _create_board(client, "alice", token_alice)
        r = client.post(
            f"/api/users/alice/boards/{board_id}/duplicate",
            json={"name": "Copy"},
            headers=_auth(token_bob),
        )
        assert r.status_code == 403


# ---------------------------------------------------------------------------
# routes/activity.py -- dashboard wrong user
# ---------------------------------------------------------------------------

class TestDashboard:
    def test_dashboard_wrong_user_forbidden(self, client: TestClient) -> None:
        _register_and_login(client, "alice")
        token_bob = _register_and_login(client, "bob")
        r = client.get("/api/users/alice/dashboard", headers=_auth(token_bob))
        assert r.status_code == 403

    def test_dashboard_success(self, client: TestClient) -> None:
        token = _register_and_login(client, "alice")
        _create_board(client, "alice", token)
        r = client.get("/api/users/alice/dashboard", headers=_auth(token))
        assert r.status_code == 200
        data = r.json()
        assert data["username"] == "alice"
        assert data["total_boards"] >= 1


# ---------------------------------------------------------------------------
# routes/comments.py -- edge cases
# ---------------------------------------------------------------------------

class TestCommentsEdgeCases:
    def test_edit_comment_not_author(self, client: TestClient) -> None:
        alice_token = _register_and_login(client, "alice")
        bob_token = _register_and_login(client, "bob")
        board_id = _create_board(client, "alice", alice_token)

        # Add bob as member
        client.post(
            f"/api/users/alice/boards/{board_id}/members",
            json={"username": "bob"},
            headers=_auth(alice_token),
        )

        # Get a card ID from the board
        board_resp = client.get(f"/api/users/alice/boards/{board_id}", headers=_auth(alice_token))
        board_data = board_resp.json()["board"]
        card_id = list(board_data["cards"].keys())[0]

        # Alice posts a comment
        r = client.post(
            f"/api/users/alice/boards/{board_id}/cards/{card_id}/comments",
            json={"body": "Alice's comment"},
            headers=_auth(alice_token),
        )
        comment_id = r.json()["id"]

        # Bob tries to edit Alice's comment
        r = client.patch(
            f"/api/users/alice/boards/{board_id}/cards/{card_id}/comments/{comment_id}",
            json={"body": "Hacked!"},
            headers=_auth(bob_token),
        )
        assert r.status_code == 403

    def test_delete_comment_by_owner(self, client: TestClient) -> None:
        alice_token = _register_and_login(client, "alice")
        bob_token = _register_and_login(client, "bob")
        board_id = _create_board(client, "alice", alice_token)

        client.post(
            f"/api/users/alice/boards/{board_id}/members",
            json={"username": "bob"},
            headers=_auth(alice_token),
        )

        board_resp = client.get(f"/api/users/alice/boards/{board_id}", headers=_auth(alice_token))
        card_id = list(board_resp.json()["board"]["cards"].keys())[0]

        # Bob posts a comment
        r = client.post(
            f"/api/users/alice/boards/{board_id}/cards/{card_id}/comments",
            json={"body": "Bob's comment"},
            headers=_auth(bob_token),
        )
        comment_id = r.json()["id"]

        # Alice (board owner) deletes Bob's comment
        r = client.delete(
            f"/api/users/alice/boards/{board_id}/cards/{card_id}/comments/{comment_id}",
            headers=_auth(alice_token),
        )
        assert r.status_code == 204
