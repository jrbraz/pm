from unittest.mock import patch

from fastapi.testclient import TestClient


class TestChatEndpoint:
    @patch("app.routes.chat.process_chat")
    def test_chat_only_response(self, mock_process, client: TestClient):
        from app.ai_chat import ChatResult
        mock_process.return_value = ChatResult(reply="Hello!", board_updated=False)

        response = client.post("/api/users/user/chat", json={"message": "hi"})

        assert response.status_code == 200
        body = response.json()
        assert body["reply"] == "Hello!"
        assert body["board_updated"] is False

    @patch("app.routes.chat.save_board_for_user")
    @patch("app.routes.chat.process_chat")
    def test_chat_with_board_update_saves(self, mock_process, mock_save, client: TestClient):
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

        response = client.post("/api/users/user/chat", json={"message": "add card"})

        assert response.status_code == 200
        assert response.json()["board_updated"] is True
        mock_save.assert_called_once()

    def test_empty_message_returns_400(self, client: TestClient):
        response = client.post("/api/users/user/chat", json={"message": ""})
        assert response.status_code == 400
        assert response.json()["error"]["code"] == "VALIDATION_ERROR"

    def test_missing_message_returns_422(self, client: TestClient):
        response = client.post("/api/users/user/chat", json={})
        assert response.status_code == 422

    @patch("app.routes.chat.process_chat")
    def test_ai_error_returns_502(self, mock_process, client: TestClient):
        mock_process.side_effect = RuntimeError("API down")

        response = client.post("/api/users/user/chat", json={"message": "hi"})

        assert response.status_code == 502
        assert response.json()["error"]["code"] == "AI_ERROR"

    @patch("app.routes.chat.process_chat")
    def test_passes_history(self, mock_process, client: TestClient):
        from app.ai_chat import ChatResult
        mock_process.return_value = ChatResult(reply="ok", board_updated=False)
        history = [
            {"role": "user", "content": "hi"},
            {"role": "assistant", "content": "hello"},
        ]

        client.post("/api/users/user/chat", json={"message": "next", "history": history})

        call_args = mock_process.call_args
        assert call_args[0][2] == history
