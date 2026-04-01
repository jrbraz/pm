import json
from pathlib import Path

from app.board_models import BoardData
from app.db import (
    create_board,
    delete_board,
    get_board_by_id,
    get_board_by_id_with_access,
    get_board_json,
    get_boards_for_user,
    get_default_board,
    get_or_create_user_id,
    rename_board,
    update_board_json,
    update_board_json_by_id,
    upsert_board_json,
)

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
            "priority": "high",
            "labels": ["strategy"],
        },
        "card-2": {
            "id": "card-2",
            "title": "Gather customer signals",
            "details": "Review support tags, sales notes, and churn feedback.",
            "priority": "medium",
            "labels": ["research"],
        },
        "card-3": {
            "id": "card-3",
            "title": "Prototype analytics view",
            "details": "Sketch initial dashboard layout and key drill-downs.",
            "priority": "medium",
            "labels": ["design"],
        },
        "card-4": {
            "id": "card-4",
            "title": "Refine status language",
            "details": "Standardize column labels and tone across the board.",
            "priority": "low",
            "labels": [],
        },
        "card-5": {
            "id": "card-5",
            "title": "Design card layout",
            "details": "Add hierarchy and spacing for scanning dense lists.",
            "priority": "medium",
            "labels": ["design"],
        },
        "card-6": {
            "id": "card-6",
            "title": "QA micro-interactions",
            "details": "Verify hover, focus, and loading states.",
            "priority": "high",
            "labels": ["qa"],
        },
        "card-7": {
            "id": "card-7",
            "title": "Ship marketing page",
            "details": "Final copy approved and asset pack delivered.",
            "priority": None,
            "labels": ["marketing"],
        },
        "card-8": {
            "id": "card-8",
            "title": "Close onboarding sprint",
            "details": "Document release notes and share internally.",
            "priority": None,
            "labels": [],
        },
    },
)


def get_or_create_board_for_user(db_path: Path, username: str) -> BoardData:
    """Legacy: get or create the default board for a user."""
    user_id = get_or_create_user_id(db_path, username)
    raw_board = get_board_json(db_path, user_id)

    if raw_board is None:
        board = DEFAULT_BOARD
        upsert_board_json(db_path, user_id, board.model_dump_json())
        return board

    parsed_board = json.loads(raw_board)
    return BoardData.model_validate(parsed_board)


def save_board_for_user(db_path: Path, username: str, board: BoardData) -> BoardData:
    """Legacy: save the default board for a user."""
    user_id = get_or_create_user_id(db_path, username)
    upsert_board_json(db_path, user_id, board.model_dump_json())
    return board


# ---------------------------------------------------------------------------
# Multi-board service functions
# ---------------------------------------------------------------------------

def list_boards_for_user(db_path: Path, username: str) -> list[dict]:
    """List all boards for a user, creating default if none exist."""
    user_id = get_or_create_user_id(db_path, username)
    boards = get_boards_for_user(db_path, user_id)
    if not boards:
        create_board(
            db_path, user_id, "My Board", DEFAULT_BOARD.model_dump_json(), is_default=True
        )
        boards = get_boards_for_user(db_path, user_id)
    return boards


def get_board_for_user(db_path: Path, username: str, board_id: int) -> BoardData | None:
    """Get a specific board by id for a user. Returns None if not found."""
    user_id = get_or_create_user_id(db_path, username)
    board_row = get_board_by_id(db_path, board_id, user_id)
    if board_row is None:
        return None
    return BoardData.model_validate(json.loads(board_row["board_json"]))


def get_named_board_for_user(db_path: Path, username: str, board_id: int) -> dict | None:
    """Get board row + parsed data for owner. Returns dict with id, name, board, is_default or None."""
    user_id = get_or_create_user_id(db_path, username)
    board_row = get_board_by_id(db_path, board_id, user_id)
    if board_row is None:
        return None
    return {
        "id": board_row["id"],
        "name": board_row["name"],
        "board": BoardData.model_validate(json.loads(board_row["board_json"])),
        "is_default": board_row["is_default"],
    }


def get_named_board_with_access(db_path: Path, user_id: int, board_id: int) -> dict | None:
    """Get board row + parsed data for owner OR member. Returns dict or None."""
    board_row = get_board_by_id_with_access(db_path, board_id, user_id)
    if board_row is None:
        return None
    return {
        "id": board_row["id"],
        "name": board_row["name"],
        "board": BoardData.model_validate(json.loads(board_row["board_json"])),
        "is_default": board_row["is_default"],
        "access_role": board_row.get("access_role", "owner"),
    }


def save_named_board_for_user(
    db_path: Path, username: str, board_id: int, board: BoardData
) -> BoardData | None:
    """Save a specific board as owner. Returns saved board or None if board not found."""
    user_id = get_or_create_user_id(db_path, username)
    existing = get_board_by_id(db_path, board_id, user_id)
    if existing is None:
        return None
    update_board_json(db_path, board_id, user_id, board.model_dump_json())
    return board


def save_named_board_with_access(
    db_path: Path, user_id: int, board_id: int, board: BoardData
) -> BoardData | None:
    """Save a specific board as owner OR member. Returns saved board or None if not found."""
    board_row = get_board_by_id_with_access(db_path, board_id, user_id)
    if board_row is None:
        return None
    # Use the board's actual owner_user_id for the update
    owner_user_id = board_row["owner_user_id"]
    if owner_user_id == user_id:
        update_board_json(db_path, board_id, user_id, board.model_dump_json())
    else:
        # Member save: update without ownership check
        update_board_json_by_id(db_path, board_id, board.model_dump_json())
    return board


def create_board_for_user(db_path: Path, username: str, name: str) -> dict:
    """Create a new board for a user. Returns board summary dict."""
    user_id = get_or_create_user_id(db_path, username)
    existing = get_boards_for_user(db_path, user_id)
    is_first = len(existing) == 0
    board_id = create_board(
        db_path, user_id, name, DEFAULT_BOARD.model_dump_json(), is_default=is_first
    )
    return {
        "id": board_id,
        "name": name,
        "is_default": is_first,
        "board": DEFAULT_BOARD,
    }


def rename_board_for_user(
    db_path: Path, username: str, board_id: int, name: str
) -> bool:
    """Rename a board. Returns True if found and renamed."""
    user_id = get_or_create_user_id(db_path, username)
    existing = get_board_by_id(db_path, board_id, user_id)
    if existing is None:
        return False
    rename_board(db_path, board_id, user_id, name)
    return True


def delete_board_for_user(db_path: Path, username: str, board_id: int) -> bool:
    """Delete a board. Returns True if deleted."""
    user_id = get_or_create_user_id(db_path, username)
    return delete_board(db_path, board_id, user_id)


def duplicate_board_for_user(db_path: Path, username: str, board_id: int, new_name: str) -> dict | None:
    """Duplicate a board under a new name. Returns new board summary or None if not found."""
    user_id = get_or_create_user_id(db_path, username)
    source = get_board_by_id(db_path, board_id, user_id)
    if source is None:
        return None
    new_board_id = create_board(db_path, user_id, new_name, source["board_json"], is_default=False)
    return {
        "id": new_board_id,
        "name": new_name,
        "is_default": False,
        "board": BoardData.model_validate(json.loads(source["board_json"])),
    }
