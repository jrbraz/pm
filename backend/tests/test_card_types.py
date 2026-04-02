"""Comprehensive tests for card type hierarchy, validation, and type-prefixed IDs."""
import json

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.board_models import BoardData, Card, CARD_TYPE_PREFIXES, ALLOWED_PARENTS


def _register_and_login(client: TestClient, username: str, password: str = "testpass1234") -> str:
    client.post("/api/auth/register", json={"username": username, "password": password})
    r = client.post("/api/auth/login", json={"username": username, "password": password})
    return r.json()["token"]


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _create_board(client: TestClient, username: str, token: str, name: str = "Test") -> int:
    r = client.post(f"/api/users/{username}/boards", json={"name": name}, headers=_auth(token))
    assert r.status_code == 201
    return r.json()["id"]


# ---------------------------------------------------------------------------
# Model: card_type and parent_id fields
# ---------------------------------------------------------------------------

class TestCardTypeModel:
    def test_card_defaults_to_initiative(self) -> None:
        card = Card(id="c1", title="Test", details="")
        assert card.card_type == "initiative"
        assert card.parent_id is None

    def test_card_accepts_all_types(self) -> None:
        for ct in CARD_TYPE_PREFIXES:
            card = Card(id="c1", title="Test", details="", card_type=ct)
            assert card.card_type == ct

    def test_card_rejects_invalid_type(self) -> None:
        with pytest.raises(ValidationError):
            Card(id="c1", title="Test", details="", card_type="invalid")


# ---------------------------------------------------------------------------
# Model: hierarchy validation
# ---------------------------------------------------------------------------

class TestHierarchyValidation:
    def test_initiative_with_no_parent_is_valid(self) -> None:
        board = BoardData(
            columns=[{"id": "col-1", "title": "Todo", "cardIds": ["c1"]}],
            cards={"c1": {"id": "c1", "title": "Init", "details": "", "card_type": "initiative", "parent_id": None}},
        )
        assert board.cards["c1"].card_type == "initiative"

    def test_initiative_with_parent_is_invalid(self) -> None:
        with pytest.raises(ValidationError, match="must not have a parent"):
            BoardData(
                columns=[{"id": "col-1", "title": "Todo", "cardIds": ["c1", "c2"]}],
                cards={
                    "c1": {"id": "c1", "title": "Init1", "details": "", "card_type": "initiative", "parent_id": None},
                    "c2": {"id": "c2", "title": "Init2", "details": "", "card_type": "initiative", "parent_id": "c1"},
                },
            )

    def test_epic_with_initiative_parent_is_valid(self) -> None:
        board = BoardData(
            columns=[{"id": "col-1", "title": "Todo", "cardIds": ["c1", "c2"]}],
            cards={
                "c1": {"id": "c1", "title": "Init", "details": "", "card_type": "initiative", "parent_id": None},
                "c2": {"id": "c2", "title": "Epic", "details": "", "card_type": "epic", "parent_id": "c1"},
            },
        )
        assert board.cards["c2"].parent_id == "c1"

    def test_epic_without_parent_is_invalid(self) -> None:
        with pytest.raises(ValidationError, match="requires a parent"):
            BoardData(
                columns=[{"id": "col-1", "title": "Todo", "cardIds": ["c1"]}],
                cards={"c1": {"id": "c1", "title": "Epic", "details": "", "card_type": "epic", "parent_id": None}},
            )

    def test_epic_with_epic_parent_is_invalid(self) -> None:
        with pytest.raises(ValidationError, match="cannot have a parent of type"):
            BoardData(
                columns=[{"id": "col-1", "title": "Todo", "cardIds": ["c1", "c2", "c3"]}],
                cards={
                    "c1": {"id": "c1", "title": "Init", "details": "", "card_type": "initiative", "parent_id": None},
                    "c2": {"id": "c2", "title": "Epic1", "details": "", "card_type": "epic", "parent_id": "c1"},
                    "c3": {"id": "c3", "title": "Epic2", "details": "", "card_type": "epic", "parent_id": "c2"},
                },
            )

    def test_task_with_epic_parent_is_valid(self) -> None:
        board = BoardData(
            columns=[{"id": "col-1", "title": "Todo", "cardIds": ["c1", "c2", "c3"]}],
            cards={
                "c1": {"id": "c1", "title": "Init", "details": "", "card_type": "initiative", "parent_id": None},
                "c2": {"id": "c2", "title": "Epic", "details": "", "card_type": "epic", "parent_id": "c1"},
                "c3": {"id": "c3", "title": "Task", "details": "", "card_type": "task", "parent_id": "c2"},
            },
        )
        assert board.cards["c3"].parent_id == "c2"

    def test_story_with_epic_parent_is_valid(self) -> None:
        BoardData(
            columns=[{"id": "col-1", "title": "Todo", "cardIds": ["c1", "c2", "c3"]}],
            cards={
                "c1": {"id": "c1", "title": "Init", "details": "", "card_type": "initiative", "parent_id": None},
                "c2": {"id": "c2", "title": "Epic", "details": "", "card_type": "epic", "parent_id": "c1"},
                "c3": {"id": "c3", "title": "Story", "details": "", "card_type": "story", "parent_id": "c2"},
            },
        )

    def test_change_scope_with_epic_parent_is_valid(self) -> None:
        BoardData(
            columns=[{"id": "col-1", "title": "Todo", "cardIds": ["c1", "c2", "c3"]}],
            cards={
                "c1": {"id": "c1", "title": "Init", "details": "", "card_type": "initiative", "parent_id": None},
                "c2": {"id": "c2", "title": "Epic", "details": "", "card_type": "epic", "parent_id": "c1"},
                "c3": {"id": "c3", "title": "CS", "details": "", "card_type": "change_scope", "parent_id": "c2"},
            },
        )

    def test_task_without_parent_is_invalid(self) -> None:
        with pytest.raises(ValidationError, match="requires a parent"):
            BoardData(
                columns=[{"id": "col-1", "title": "Todo", "cardIds": ["c1"]}],
                cards={"c1": {"id": "c1", "title": "Task", "details": "", "card_type": "task", "parent_id": None}},
            )

    def test_task_with_initiative_parent_is_invalid(self) -> None:
        with pytest.raises(ValidationError, match="cannot have a parent of type"):
            BoardData(
                columns=[{"id": "col-1", "title": "Todo", "cardIds": ["c1", "c2"]}],
                cards={
                    "c1": {"id": "c1", "title": "Init", "details": "", "card_type": "initiative", "parent_id": None},
                    "c2": {"id": "c2", "title": "Task", "details": "", "card_type": "task", "parent_id": "c1"},
                },
            )

    def test_sub_task_with_task_parent_is_valid(self) -> None:
        # Sub-tasks are NOT in column cardIds
        BoardData(
            columns=[{"id": "col-1", "title": "Todo", "cardIds": ["c1", "c2", "c3"]}],
            cards={
                "c1": {"id": "c1", "title": "Init", "details": "", "card_type": "initiative", "parent_id": None},
                "c2": {"id": "c2", "title": "Epic", "details": "", "card_type": "epic", "parent_id": "c1"},
                "c3": {"id": "c3", "title": "Task", "details": "", "card_type": "task", "parent_id": "c2"},
                "c4": {"id": "c4", "title": "Sub", "details": "", "card_type": "sub_task", "parent_id": "c3"},
            },
        )

    def test_sub_task_with_story_parent_is_valid(self) -> None:
        BoardData(
            columns=[{"id": "col-1", "title": "Todo", "cardIds": ["c1", "c2", "c3"]}],
            cards={
                "c1": {"id": "c1", "title": "Init", "details": "", "card_type": "initiative", "parent_id": None},
                "c2": {"id": "c2", "title": "Epic", "details": "", "card_type": "epic", "parent_id": "c1"},
                "c3": {"id": "c3", "title": "Story", "details": "", "card_type": "story", "parent_id": "c2"},
                "c4": {"id": "c4", "title": "Sub", "details": "", "card_type": "sub_task", "parent_id": "c3"},
            },
        )

    def test_sub_task_with_change_scope_parent_is_valid(self) -> None:
        BoardData(
            columns=[{"id": "col-1", "title": "Todo", "cardIds": ["c1", "c2", "c3"]}],
            cards={
                "c1": {"id": "c1", "title": "Init", "details": "", "card_type": "initiative", "parent_id": None},
                "c2": {"id": "c2", "title": "Epic", "details": "", "card_type": "epic", "parent_id": "c1"},
                "c3": {"id": "c3", "title": "CS", "details": "", "card_type": "change_scope", "parent_id": "c2"},
                "c4": {"id": "c4", "title": "Sub", "details": "", "card_type": "sub_task", "parent_id": "c3"},
            },
        )

    def test_sub_task_with_epic_parent_is_invalid(self) -> None:
        with pytest.raises(ValidationError, match="cannot have a parent of type"):
            BoardData(
                columns=[{"id": "col-1", "title": "Todo", "cardIds": ["c1", "c2"]}],
                cards={
                    "c1": {"id": "c1", "title": "Init", "details": "", "card_type": "initiative", "parent_id": None},
                    "c2": {"id": "c2", "title": "Epic", "details": "", "card_type": "epic", "parent_id": "c1"},
                    "c3": {"id": "c3", "title": "Sub", "details": "", "card_type": "sub_task", "parent_id": "c2"},
                },
            )

    def test_sub_task_without_parent_is_invalid(self) -> None:
        with pytest.raises(ValidationError, match="requires a parent"):
            BoardData(
                columns=[{"id": "col-1", "title": "Todo", "cardIds": []}],
                cards={"c1": {"id": "c1", "title": "Sub", "details": "", "card_type": "sub_task", "parent_id": None}},
            )

    def test_parent_id_references_nonexistent_card(self) -> None:
        with pytest.raises(ValidationError, match="unknown parent"):
            BoardData(
                columns=[{"id": "col-1", "title": "Todo", "cardIds": ["c1"]}],
                cards={"c1": {"id": "c1", "title": "Epic", "details": "", "card_type": "epic", "parent_id": "nonexistent"}},
            )

    def test_sub_task_not_in_column_is_valid(self) -> None:
        """Sub-tasks should NOT be in column cardIds."""
        board = BoardData(
            columns=[{"id": "col-1", "title": "Todo", "cardIds": ["c1", "c2", "c3"]}],
            cards={
                "c1": {"id": "c1", "title": "Init", "details": "", "card_type": "initiative", "parent_id": None},
                "c2": {"id": "c2", "title": "Epic", "details": "", "card_type": "epic", "parent_id": "c1"},
                "c3": {"id": "c3", "title": "Task", "details": "", "card_type": "task", "parent_id": "c2"},
                "st1": {"id": "st1", "title": "Sub", "details": "", "card_type": "sub_task", "parent_id": "c3"},
            },
        )
        assert "st1" not in board.columns[0].cardIds

    def test_non_subtask_not_in_column_is_invalid(self) -> None:
        """Non-sub_task cards MUST be in a column."""
        with pytest.raises(ValidationError, match="not referenced by any column"):
            BoardData(
                columns=[{"id": "col-1", "title": "Todo", "cardIds": ["c1"]}],
                cards={
                    "c1": {"id": "c1", "title": "Init", "details": "", "card_type": "initiative", "parent_id": None},
                    "c2": {"id": "c2", "title": "Epic", "details": "", "card_type": "epic", "parent_id": "c1"},
                },
            )


# ---------------------------------------------------------------------------
# API: type-prefixed card IDs
# ---------------------------------------------------------------------------

class TestTypePrefixedIds:
    def test_default_returns_init_prefix(self, client: TestClient) -> None:
        token = _register_and_login(client, "alice")
        client.get("/api/users/alice/boards", headers=_auth(token))
        r = client.post("/api/users/alice/next-card-id", headers=_auth(token))
        assert r.json()["card_id"].startswith("INIT-")

    def test_epic_prefix(self, client: TestClient) -> None:
        token = _register_and_login(client, "alice")
        client.get("/api/users/alice/boards", headers=_auth(token))
        r = client.post(
            "/api/users/alice/next-card-id",
            json={"card_type": "epic"},
            headers={**_auth(token), "Content-Type": "application/json"},
        )
        assert r.json()["card_id"].startswith("EPIC-")

    def test_task_prefix(self, client: TestClient) -> None:
        token = _register_and_login(client, "alice")
        client.get("/api/users/alice/boards", headers=_auth(token))
        r = client.post(
            "/api/users/alice/next-card-id",
            json={"card_type": "task"},
            headers={**_auth(token), "Content-Type": "application/json"},
        )
        assert r.json()["card_id"].startswith("TASK-")

    def test_story_prefix(self, client: TestClient) -> None:
        token = _register_and_login(client, "alice")
        client.get("/api/users/alice/boards", headers=_auth(token))
        r = client.post(
            "/api/users/alice/next-card-id",
            json={"card_type": "story"},
            headers={**_auth(token), "Content-Type": "application/json"},
        )
        assert r.json()["card_id"].startswith("STORY-")

    def test_change_scope_prefix(self, client: TestClient) -> None:
        token = _register_and_login(client, "alice")
        client.get("/api/users/alice/boards", headers=_auth(token))
        r = client.post(
            "/api/users/alice/next-card-id",
            json={"card_type": "change_scope"},
            headers={**_auth(token), "Content-Type": "application/json"},
        )
        assert r.json()["card_id"].startswith("CS-")

    def test_sub_task_prefix(self, client: TestClient) -> None:
        token = _register_and_login(client, "alice")
        client.get("/api/users/alice/boards", headers=_auth(token))
        r = client.post(
            "/api/users/alice/next-card-id",
            json={"card_type": "sub_task"},
            headers={**_auth(token), "Content-Type": "application/json"},
        )
        assert r.json()["card_id"].startswith("ST-")

    def test_sequence_is_global_across_types(self, client: TestClient) -> None:
        token = _register_and_login(client, "alice")
        client.get("/api/users/alice/boards", headers=_auth(token))

        r1 = client.post(
            "/api/users/alice/next-card-id",
            json={"card_type": "initiative"},
            headers={**_auth(token), "Content-Type": "application/json"},
        )
        r2 = client.post(
            "/api/users/alice/next-card-id",
            json={"card_type": "epic"},
            headers={**_auth(token), "Content-Type": "application/json"},
        )
        r3 = client.post(
            "/api/users/alice/next-card-id",
            json={"card_type": "task"},
            headers={**_auth(token), "Content-Type": "application/json"},
        )
        # Should be INIT-9, EPIC-10, TASK-11 (seq 8 from default board)
        assert r1.json()["card_id"] == "INIT-9"
        assert r2.json()["card_id"] == "EPIC-10"
        assert r3.json()["card_id"] == "TASK-11"


# ---------------------------------------------------------------------------
# API: default board has typed cards
# ---------------------------------------------------------------------------

class TestDefaultBoardTypes:
    def test_default_board_has_initiatives(self, client: TestClient) -> None:
        token = _register_and_login(client, "alice")
        r = client.get("/api/users/alice/board", headers=_auth(token))
        board = r.json()["board"]
        assert board["cards"]["INIT-1"]["card_type"] == "initiative"
        assert board["cards"]["INIT-1"]["parent_id"] is None

    def test_default_board_has_epics_under_initiatives(self, client: TestClient) -> None:
        token = _register_and_login(client, "alice")
        r = client.get("/api/users/alice/board", headers=_auth(token))
        board = r.json()["board"]
        assert board["cards"]["EPIC-3"]["card_type"] == "epic"
        assert board["cards"]["EPIC-3"]["parent_id"] == "INIT-1"

    def test_default_board_has_tasks_under_epics(self, client: TestClient) -> None:
        token = _register_and_login(client, "alice")
        r = client.get("/api/users/alice/board", headers=_auth(token))
        board = r.json()["board"]
        assert board["cards"]["TASK-6"]["card_type"] == "task"
        assert board["cards"]["TASK-6"]["parent_id"] == "EPIC-3"

    def test_default_board_hierarchy_is_valid(self, client: TestClient) -> None:
        """The default board should pass all hierarchy validation."""
        token = _register_and_login(client, "alice")
        r = client.get("/api/users/alice/board", headers=_auth(token))
        board_data = r.json()["board"]
        # This should not raise
        BoardData.model_validate(board_data)


# ---------------------------------------------------------------------------
# ALLOWED_PARENTS reference
# ---------------------------------------------------------------------------

class TestAllowedParentsConfig:
    def test_initiative_has_no_allowed_parents(self) -> None:
        assert ALLOWED_PARENTS["initiative"] is None

    def test_epic_parent_is_initiative(self) -> None:
        assert ALLOWED_PARENTS["epic"] == {"initiative"}

    def test_task_parent_is_epic(self) -> None:
        assert ALLOWED_PARENTS["task"] == {"epic"}

    def test_story_parent_is_epic(self) -> None:
        assert ALLOWED_PARENTS["story"] == {"epic"}

    def test_change_scope_parent_is_epic(self) -> None:
        assert ALLOWED_PARENTS["change_scope"] == {"epic"}

    def test_sub_task_parents_are_level3(self) -> None:
        assert ALLOWED_PARENTS["sub_task"] == {"task", "story", "change_scope"}
