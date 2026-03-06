import os

import httpx

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
DEFAULT_MODEL = "openai/gpt-oss-120b"
TIMEOUT_SECONDS = 60


def _get_api_key() -> str:
    key = os.getenv("OPENROUTER_API_KEY") or os.getenv("openrouter_api_key")
    if not key:
        raise RuntimeError("OPENROUTER_API_KEY is not set")
    return key


def chat_completion(
    messages: list[dict[str, str]],
    model: str = DEFAULT_MODEL,
    api_key: str | None = None,
) -> str:
    """Send a chat completion request to OpenRouter and return the assistant message content."""
    key = api_key or _get_api_key()

    response = httpx.post(
        f"{OPENROUTER_BASE_URL}/chat/completions",
        headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        },
        json={
            "model": model,
            "messages": messages,
        },
        timeout=TIMEOUT_SECONDS,
    )
    response.raise_for_status()

    data = response.json()
    return data["choices"][0]["message"]["content"]
