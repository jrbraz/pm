import json
from pathlib import Path

from app.board_models import BoardData
from app.db import get_board_json, get_or_create_user_id, upsert_board_json

DEFAULT_BOARD = BoardData(
    columns=[
        {"id": "col-backlog", "title": "Backlog", "cardIds": ["card-1", "card-2"]},
        {"id": "col-discovery", "title": "Discovery", "cardIds": ["card-3"]},
        {"id": "col-progress", "title": "In Progress", "cardIds": ["card-4", "card-5"]},
        {"id": "col-review", "title": "Review", "cardIds": ["card-6"]},
        {"id": "col-done", "title": "Done", "cardIds": ["card-7", "card-8"]},
    ],
    cards={
        "card-1": {
            "id": "card-1",
            "title": "Align roadmap themes",
            "details": "Draft quarterly themes with impact statements and metrics.",
        },
        "card-2": {
            "id": "card-2",
            "title": "Gather customer signals",
            "details": "Review support tags, sales notes, and churn feedback.",
        },
        "card-3": {
            "id": "card-3",
            "title": "Prototype analytics view",
            "details": "Sketch initial dashboard layout and key drill-downs.",
        },
        "card-4": {
            "id": "card-4",
            "title": "Refine status language",
            "details": "Standardize column labels and tone across the board.",
        },
        "card-5": {
            "id": "card-5",
            "title": "Design card layout",
            "details": "Add hierarchy and spacing for scanning dense lists.",
        },
        "card-6": {
            "id": "card-6",
            "title": "QA micro-interactions",
            "details": "Verify hover, focus, and loading states.",
        },
        "card-7": {
            "id": "card-7",
            "title": "Ship marketing page",
            "details": "Final copy approved and asset pack delivered.",
        },
        "card-8": {
            "id": "card-8",
            "title": "Close onboarding sprint",
            "details": "Document release notes and share internally.",
        },
    },
)


def get_or_create_board_for_user(db_path: Path, username: str) -> BoardData:
    user_id = get_or_create_user_id(db_path, username)
    raw_board = get_board_json(db_path, user_id)

    if raw_board is None:
        board = DEFAULT_BOARD
        upsert_board_json(db_path, user_id, board.model_dump_json())
        return board

    parsed_board = json.loads(raw_board)
    return BoardData.model_validate(parsed_board)


def save_board_for_user(db_path: Path, username: str, board: BoardData) -> BoardData:
    user_id = get_or_create_user_id(db_path, username)
    upsert_board_json(db_path, user_id, board.model_dump_json())
    return board
