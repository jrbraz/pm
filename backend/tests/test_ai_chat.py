import json
import sys
from pathlib import Path
from unittest.mock import patch

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.ai_chat import (
    AiChatResponse,
    build_messages,
    parse_ai_response,
    process_chat,
)
from app.board_models import BoardData


def _minimal_board() -> BoardData:
    return BoardData(
        columns=[{"id": "col-1", "title": "Backlog", "cardIds": ["card-1"]}],
        cards={"card-1": {"id": "card-1", "title": "Test card", "details": ""}},
    )


class TestBuildMessages:
    def test_includes_system_board_and_user_message(self):
        board = _minimal_board()
        messages = build_messages(board, "Hello", [])

        assert messages[0]["role"] == "system"
        assert "Kanban" in messages[0]["content"]
        assert messages[1]["role"] == "system"
        assert "col-1" in messages[1]["content"]
        assert messages[-1] == {"role": "user", "content": "Hello"}

    def test_includes_history(self):
        board = _minimal_board()
        history = [
            {"role": "user", "content": "hi"},
            {"role": "assistant", "content": "hello"},
        ]
        messages = build_messages(board, "what next?", history)

        assert messages[2] == {"role": "user", "content": "hi"}
        assert messages[3] == {"role": "assistant", "content": "hello"}
        assert messages[4] == {"role": "user", "content": "what next?"}


class TestParseAiResponse:
    def test_parses_chat_only_response(self):
        raw = json.dumps({"reply": "Hello!", "board_update": None})
        result = parse_ai_response(raw)
        assert result.reply == "Hello!"
        assert result.board_update is None

    def test_parses_response_with_board_update(self):
        board_data = {
            "columns": [{"id": "col-1", "title": "Todo", "cardIds": ["card-1"]}],
            "cards": {"card-1": {"id": "card-1", "title": "New task", "details": ""}},
        }
        raw = json.dumps({"reply": "Created a card.", "board_update": board_data})
        result = parse_ai_response(raw)
        assert result.reply == "Created a card."
        assert result.board_update is not None
        assert result.board_update.cards["card-1"].title == "New task"

    def test_strips_markdown_code_fences(self):
        inner = json.dumps({"reply": "Hi", "board_update": None})
        raw = f"```json\n{inner}\n```"
        result = parse_ai_response(raw)
        assert result.reply == "Hi"

    def test_raises_on_invalid_json(self):
        with pytest.raises(json.JSONDecodeError):
            parse_ai_response("not json at all")

    def test_raises_on_invalid_board_update(self):
        raw = json.dumps({
            "reply": "Done",
            "board_update": {"columns": [], "cards": {"c1": {"id": "c1", "title": "", "details": ""}}},
        })
        with pytest.raises(Exception):
            parse_ai_response(raw)

    def test_raises_on_missing_reply(self):
        raw = json.dumps({"board_update": None})
        with pytest.raises(Exception):
            parse_ai_response(raw)

    def test_validates_card_references(self):
        raw = json.dumps({
            "reply": "Done",
            "board_update": {
                "columns": [{"id": "col-1", "title": "Todo", "cardIds": ["card-missing"]}],
                "cards": {"card-1": {"id": "card-1", "title": "Task", "details": ""}},
            },
        })
        with pytest.raises(Exception):
            parse_ai_response(raw)


class TestProcessChat:
    @patch("app.ai_chat.chat_completion")
    def test_chat_only_response(self, mock_chat):
        mock_chat.return_value = json.dumps({"reply": "Sure thing!", "board_update": None})
        board = _minimal_board()

        result = process_chat(board, "hi", [])

        assert result.reply == "Sure thing!"
        assert result.board_updated is False
        assert result.board is None

    @patch("app.ai_chat.chat_completion")
    def test_response_with_board_update(self, mock_chat):
        updated_board = {
            "columns": [{"id": "col-1", "title": "Backlog", "cardIds": ["card-1", "card-2"]}],
            "cards": {
                "card-1": {"id": "card-1", "title": "Test card", "details": ""},
                "card-2": {"id": "card-2", "title": "New card", "details": "Added by AI"},
            },
        }
        mock_chat.return_value = json.dumps({"reply": "Added a card.", "board_update": updated_board})
        board = _minimal_board()

        result = process_chat(board, "add a card", [])

        assert result.reply == "Added a card."
        assert result.board_updated is True
        assert result.board is not None
        assert "card-2" in result.board.cards

    @patch("app.ai_chat.chat_completion")
    def test_raises_on_invalid_ai_output(self, mock_chat):
        mock_chat.return_value = "this is not json"
        board = _minimal_board()

        with pytest.raises(json.JSONDecodeError):
            process_chat(board, "do something", [])
