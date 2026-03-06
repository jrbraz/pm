import json
import sys
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.main import create_app


def _client() -> TestClient:
    fixture_dir = Path(__file__).resolve().parent / "fixtures" / "frontend_dist"
    return TestClient(create_app(fixture_dir))


class TestChatEndpoint:
    @patch("app.main.process_chat")
    def test_chat_only_response(self, mock_process):
        from app.ai_chat import ChatResult
        mock_process.return_value = ChatResult(reply="Hello!", board_updated=False)
        client = _client()

        response = client.post("/api/users/user/chat", json={"message": "hi"})

        assert response.status_code == 200
        body = response.json()
        assert body["reply"] == "Hello!"
        assert body["board_updated"] is False

    @patch("app.main.save_board_for_user")
    @patch("app.main.process_chat")
    def test_chat_with_board_update_saves(self, mock_process, mock_save):
        from app.ai_chat import ChatResult
        from app.board_models import BoardData
        updated_board = BoardData(
            columns=[{"id": "col-1", "title": "Todo", "cardIds": ["card-1"]}],
            cards={"card-1": {"id": "card-1", "title": "New", "details": ""}},
        )
        mock_process.return_value = ChatResult(
            reply="Done!", board_updated=True, board=updated_board
        )
        mock_save.return_value = updated_board
        client = _client()

        response = client.post("/api/users/user/chat", json={"message": "add card"})

        assert response.status_code == 200
        assert response.json()["board_updated"] is True
        mock_save.assert_called_once()

    def test_empty_message_returns_400(self):
        client = _client()
        response = client.post("/api/users/user/chat", json={"message": ""})
        assert response.status_code == 400
        assert response.json()["error"]["code"] == "VALIDATION_ERROR"

    def test_missing_message_returns_400(self):
        client = _client()
        response = client.post("/api/users/user/chat", json={})
        assert response.status_code == 400

    @patch("app.main.process_chat")
    def test_ai_error_returns_502(self, mock_process):
        mock_process.side_effect = RuntimeError("API down")
        client = _client()

        response = client.post("/api/users/user/chat", json={"message": "hi"})

        assert response.status_code == 502
        assert response.json()["error"]["code"] == "AI_ERROR"

    @patch("app.main.process_chat")
    def test_passes_history(self, mock_process):
        from app.ai_chat import ChatResult
        mock_process.return_value = ChatResult(reply="ok", board_updated=False)
        client = _client()
        history = [
            {"role": "user", "content": "hi"},
            {"role": "assistant", "content": "hello"},
        ]

        client.post("/api/users/user/chat", json={"message": "next", "history": history})

        call_args = mock_process.call_args
        assert call_args[0][2] == history
