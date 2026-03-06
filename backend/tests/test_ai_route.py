from unittest.mock import patch

from fastapi.testclient import TestClient


class TestAiTestRoute:
    @patch("app.routes.ai_test.chat_completion")
    def test_returns_ai_result(self, mock_chat, client: TestClient):
        mock_chat.return_value = "4"

        response = client.post("/api/ai/test", json={"prompt": "What is 2+2?"})

        assert response.status_code == 200
        assert response.json() == {"result": "4"}
        mock_chat.assert_called_once()

    @patch("app.routes.ai_test.chat_completion")
    def test_uses_default_prompt(self, mock_chat, client: TestClient):
        mock_chat.return_value = "4"

        response = client.post("/api/ai/test", json={})

        assert response.status_code == 200
        call_args = mock_chat.call_args
        assert "2+2" in call_args.kwargs["messages"][0]["content"]

    @patch("app.routes.ai_test.chat_completion")
    def test_returns_502_on_ai_failure(self, mock_chat, client: TestClient):
        mock_chat.side_effect = RuntimeError("OPENROUTER_API_KEY is not set")

        response = client.post("/api/ai/test", json={"prompt": "hello"})

        assert response.status_code == 502
        body = response.json()
        assert body["error"]["code"] == "AI_ERROR"
