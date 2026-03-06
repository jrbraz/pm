import sys
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.main import create_app


def _client() -> TestClient:
    fixture_dir = Path(__file__).resolve().parent / "fixtures" / "frontend_dist"
    return TestClient(create_app(fixture_dir))


class TestAiTestRoute:
    @patch("app.main.chat_completion")
    def test_returns_ai_result(self, mock_chat):
        mock_chat.return_value = "4"
        client = _client()

        response = client.post("/api/ai/test", json={"prompt": "What is 2+2?"})

        assert response.status_code == 200
        assert response.json() == {"result": "4"}
        mock_chat.assert_called_once()

    @patch("app.main.chat_completion")
    def test_uses_default_prompt(self, mock_chat):
        mock_chat.return_value = "4"
        client = _client()

        response = client.post("/api/ai/test", json={})

        assert response.status_code == 200
        call_args = mock_chat.call_args
        assert "2+2" in call_args.kwargs["messages"][0]["content"]

    @patch("app.main.chat_completion")
    def test_returns_502_on_ai_failure(self, mock_chat):
        mock_chat.side_effect = RuntimeError("OPENROUTER_API_KEY is not set")
        client = _client()

        response = client.post("/api/ai/test", json={"prompt": "hello"})

        assert response.status_code == 502
        body = response.json()
        assert body["error"]["code"] == "AI_ERROR"
