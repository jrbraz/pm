from datetime import date
from pathlib import Path

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse

from app.db import (
    get_boards_accessible_to_user,
    get_activity_for_board,
    get_board_by_id_with_access,
    get_recent_activity_for_user,
    get_or_create_user_id,
)
from app.deps import get_current_user, require_board_access
from app.errors import error_payload

router = APIRouter(prefix="/api")


def _db(request: Request) -> Path:
    return request.app.state.db_path


# ---------------------------------------------------------------------------
# Activity log
# ---------------------------------------------------------------------------

@router.get("/users/{username}/boards/{board_id}/activity")
def get_board_activity(
    username: str,
    board_id: int,
    request: Request,
    current_user: dict = Depends(get_current_user),
    limit: int = 50,
    offset: int = 0,
    card_id: str | None = None,
) -> dict:
    db_path = _db(request)
    require_board_access(board_id, current_user["user_id"], db_path, minimum_role="viewer")
    entries = get_activity_for_board(db_path, board_id, limit=limit, offset=offset, card_id=card_id)
    return {"board_id": board_id, "activity": entries}


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------

@router.get("/users/{username}/dashboard")
def get_dashboard(
    username: str,
    request: Request,
    current_user: dict = Depends(get_current_user),
) -> dict:
    db_path = _db(request)

    # Ensure the username matches the token
    if current_user["username"] != username:
        return JSONResponse(
            status_code=403,
            content=error_payload("FORBIDDEN", "Access denied."),
        )

    user_id = current_user["user_id"]
    boards = get_boards_accessible_to_user(db_path, user_id)

    import json
    from app.board_models import BoardData

    today = date.today().isoformat()
    board_summaries = []
    total_cards = 0
    total_overdue = 0

    for b in boards:
        try:
            board_row = get_board_by_id_with_access(db_path, b["id"], user_id)
            if board_row is None:
                continue
            board_data = BoardData.model_validate(json.loads(board_row["board_json"]))
            cards = list(board_data.cards.values())
            card_count = len(cards)
            overdue = sum(1 for c in cards if c.due_date and c.due_date < today)
            total_cards += card_count
            total_overdue += overdue
            board_summaries.append({
                "id": b["id"],
                "name": b["name"],
                "owner_username": b.get("owner_username", username),
                "access_role": b.get("access_role", "owner"),
                "is_default": b["is_default"],
                "card_count": card_count,
                "overdue": overdue,
                "updated_at": b["updated_at"],
            })
        except Exception:
            continue

    recent_activity = get_recent_activity_for_user(db_path, user_id, limit=20)

    return {
        "username": username,
        "total_boards": len(board_summaries),
        "total_cards": total_cards,
        "total_overdue": total_overdue,
        "boards": board_summaries,
        "recent_activity": recent_activity,
    }
