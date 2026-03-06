import json

from pydantic import BaseModel, ValidationError

from app.ai_client import chat_completion
from app.board_models import BoardData

SYSTEM_PROMPT = """\
You are an AI assistant for a Kanban board project management app.
The user can ask you to create, edit, move, or delete cards on their board.

You will receive the current board state as JSON and the user's message.

You MUST respond with valid JSON in this exact format:
{
  "reply": "Your conversational response to the user.",
  "board_update": null
}

If the user asks you to modify the board, include the full updated board state:
{
  "reply": "Your conversational response describing what you changed.",
  "board_update": { "columns": [...], "cards": {...} }
}

Rules for board updates:
- "columns" is a list of objects with "id" (string), "title" (string), and "cardIds" (list of strings).
- "cards" is a dict mapping card id strings to objects with "id" (string), "title" (string), and "details" (string).
- Every card id referenced in a column's cardIds must exist in the cards dict.
- When creating new cards, use ids like "card-<timestamp>" to avoid collisions.
- Always return the COMPLETE board state, not just the changes.
- If the user's request is unclear, ask for clarification and set board_update to null.

IMPORTANT: Respond ONLY with the JSON object. No markdown, no code fences, no extra text.\
"""


class AiChatResponse(BaseModel):
    reply: str
    board_update: BoardData | None = None


class ChatResult(BaseModel):
    reply: str
    board_updated: bool
    board: BoardData | None = None


def build_messages(
    board: BoardData,
    user_message: str,
    history: list[dict[str, str]],
) -> list[dict[str, str]]:
    messages: list[dict[str, str]] = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "system", "content": f"Current board state:\n{board.model_dump_json()}"},
    ]
    messages.extend(history)
    messages.append({"role": "user", "content": user_message})
    return messages


def parse_ai_response(raw: str) -> AiChatResponse:
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        lines = cleaned.split("\n")
        lines = lines[1:]  # remove opening fence
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        cleaned = "\n".join(lines)

    data = json.loads(cleaned)
    return AiChatResponse.model_validate(data)


def process_chat(
    board: BoardData,
    user_message: str,
    history: list[dict[str, str]],
    api_key: str | None = None,
) -> ChatResult:
    messages = build_messages(board, user_message, history)
    raw = chat_completion(messages=messages, api_key=api_key)
    parsed = parse_ai_response(raw)

    if parsed.board_update is not None:
        return ChatResult(
            reply=parsed.reply,
            board_updated=True,
            board=parsed.board_update,
        )

    return ChatResult(reply=parsed.reply, board_updated=False)
