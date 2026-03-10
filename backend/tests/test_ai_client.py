from unittest.mock import patch, MagicMock

import os
import sys

import httpx
import pytest

from app.ai_client import chat_completion, get_api_key

_WIN = sys.platform == "win32"


def _mock_response(content: str) -> MagicMock:
    resp = MagicMock(spec=httpx.Response)
    resp.status_code = 200
    resp.json.return_value = {
        "choices": [{"message": {"content": content}}]
    }
    resp.raise_for_status = MagicMock()
    return resp


class TestGetApiKey:
    def test_reads_uppercase_env(self, monkeypatch):
        monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
        if not _WIN:
            monkeypatch.delenv("openrouter_api_key", raising=False)
        monkeypatch.setenv("OPENROUTER_API_KEY", "sk-test-upper")
        assert get_api_key() == "sk-test-upper"

    @pytest.mark.skipif(_WIN, reason="Windows env vars are case-insensitive")
    def test_reads_lowercase_env(self, monkeypatch):
        monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
        monkeypatch.setenv("openrouter_api_key", "sk-test-lower")
        assert get_api_key() == "sk-test-lower"

    def test_raises_when_missing(self, monkeypatch):
        monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
        if not _WIN:
            monkeypatch.delenv("openrouter_api_key", raising=False)
        with pytest.raises(RuntimeError, match="OPENROUTER_API_KEY is not set"):
            get_api_key()


class TestChatCompletion:
    @patch("app.ai_client.httpx.post")
    def test_sends_correct_request(self, mock_post):
        mock_post.return_value = _mock_response("4")

        result = chat_completion(
            messages=[{"role": "user", "content": "2+2"}],
            api_key="sk-test",
        )

        assert result == "4"
        mock_post.assert_called_once()
        call_kwargs = mock_post.call_args
        assert "Bearer sk-test" in call_kwargs.kwargs["headers"]["Authorization"]
        assert call_kwargs.kwargs["json"]["model"] == "openai/gpt-oss-120b"
        assert call_kwargs.kwargs["json"]["messages"] == [{"role": "user", "content": "2+2"}]

    @patch("app.ai_client.httpx.post")
    def test_custom_model(self, mock_post):
        mock_post.return_value = _mock_response("hello")

        chat_completion(
            messages=[{"role": "user", "content": "hi"}],
            model="custom/model",
            api_key="sk-test",
        )

        assert mock_post.call_args.kwargs["json"]["model"] == "custom/model"

    @patch("app.ai_client.httpx.post")
    def test_raises_on_http_error(self, mock_post):
        resp = MagicMock(spec=httpx.Response)
        resp.raise_for_status.side_effect = httpx.HTTPStatusError(
            "401", request=MagicMock(), response=resp
        )
        mock_post.return_value = resp

        with pytest.raises(httpx.HTTPStatusError):
            chat_completion(
                messages=[{"role": "user", "content": "test"}],
                api_key="sk-bad",
            )

    @patch("app.ai_client.httpx.post")
    def test_uses_env_key_when_not_provided(self, mock_post, monkeypatch):
        monkeypatch.setenv("OPENROUTER_API_KEY", "sk-from-env")
        mock_post.return_value = _mock_response("ok")

        chat_completion(messages=[{"role": "user", "content": "hi"}])

        assert "Bearer sk-from-env" in mock_post.call_args.kwargs["headers"]["Authorization"]
