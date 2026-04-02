import json

from pydantic import BaseModel, ValidationError

from app.ai_client import chat_completion
from app.board_models import BoardData

SYSTEM_PROMPT_TEMPLATE = """\
You are an AI assistant for a Kanban board project management app.
The user can ask you to create, edit, move, or delete cards and columns on their board.

IMPORTANT: The current board state is provided below. You already have all the data you need.
Do NOT ask the user to provide the board state -- it is included in this message.

You MUST respond with valid JSON in this exact format:
{{
  "reply": "Your conversational response to the user.",
  "board_update": null
}}

If the user asks you to modify the board, include the full updated board state:
{{
  "reply": "Your conversational response describing what you changed.",
  "board_update": {{ "columns": [...], "cards": {{...}} }}
}}

Rules for board updates:
- "columns" is a list of objects with "id" (string), "title" (string), and "cardIds" (list of strings).
- "cards" is a dict mapping card id strings to card objects.
- Each card object has these fields:
  - "id": string (required)
  - "title": string (required, non-empty)
  - "details": string (required, can be empty "")
  - "card_type": one of "initiative", "epic", "task", "story", "change_scope", "sub_task" (default "initiative")
  - "parent_id": string (ID of the parent card) or null
  - "priority": one of "low", "medium", "high", "critical", or null
  - "labels": array of strings (can be empty [])
  - "due_date": date string "YYYY-MM-DD" or null
- Card type hierarchy (strict rules):
  - "initiative": parent_id MUST be null (top-level only)
  - "epic": parent_id MUST reference an "initiative" card
  - "task", "story", "change_scope": parent_id MUST reference an "epic" card
  - "sub_task": parent_id MUST reference a "task", "story", or "change_scope" card
- Card ID prefixes by type: INIT-N, EPIC-N, TASK-N, STORY-N, CS-N, ST-N (where N is a number).
- When creating new cards, use the correct prefix for the type with a random number to avoid collisions.
- Sub-task cards are NOT placed in columns. Only initiative, epic, task, story, and change_scope go in cardIds.
- Every non-sub_task card id referenced in a column's cardIds must exist in the cards dict.
- Always return the COMPLETE board state, not just the changes.
- When the user asks to prioritize or mark something urgent, set priority to "high" or "critical".
- When the user asks to add a label or tag, add it to the card's labels array.
- When the user asks to break down or split a card, create child cards of the appropriate type.
- If the user's request is unclear, ask for clarification and set board_update to null.

IMPORTANT: Respond ONLY with the JSON object. No markdown, no code fences, no extra text.

--- CURRENT BOARD STATE (you already have this data) ---
{board_json}
--- END BOARD STATE ---\
"""


class AiChatResponse(BaseModel):
    reply: str
    board_update: BoardData | None = None


class ChatResult(BaseModel):
    reply: str
    board_updated: bool
    board: BoardData | None = None


# Cap conversation history sent to the AI to control token usage and cost.
# 20 messages (~10 user/assistant pairs) provides enough context for follow-up
# questions while keeping the request well within typical model context limits.
MAX_HISTORY_MESSAGES = 20


def build_messages(
    board: BoardData,
    user_message: str,
    history: list[dict[str, str]],
) -> list[dict[str, str]]:
    system_content = SYSTEM_PROMPT_TEMPLATE.format(board_json=board.model_dump_json())
    messages: list[dict[str, str]] = [
        {"role": "system", "content": system_content},
    ]
    trimmed_history = history[-MAX_HISTORY_MESSAGES:]
    messages.extend(trimmed_history)
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
