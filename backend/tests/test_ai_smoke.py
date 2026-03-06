"""Smoke test for OpenRouter connectivity.

Requires OPENROUTER_API_KEY (or openrouter_api_key) to be set.
Skip automatically when the key is absent.

Run: python3 -m pytest tests/test_ai_smoke.py -v
"""

import os
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.ai_client import chat_completion

_has_api_key = bool(os.getenv("OPENROUTER_API_KEY") or os.getenv("openrouter_api_key"))


@pytest.mark.skipif(not _has_api_key, reason="OPENROUTER_API_KEY not set")
def test_2_plus_2_round_trip():
    result = chat_completion(
        messages=[{"role": "user", "content": "What is 2+2? Reply with just the number, nothing else."}]
    )
    assert "4" in result
