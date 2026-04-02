import json
from datetime import date
from pathlib import Path

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.board_models import BoardData, BoardListResponse, BoardResponse, BoardSummary, NamedBoardResponse
from app.board_service import (
    create_board_for_user,
    delete_board_for_user,
    duplicate_board_for_user,
    get_named_board_for_user,
    get_named_board_with_access,
    get_or_create_board_for_user,
    list_boards_for_user,
    rename_board_for_user,
    save_board_for_user,
    save_named_board_with_access,
)
from app.db import log_activity, get_or_create_user_id
from app.deps import get_current_user, require_board_access
from app.errors import error_payload

router = APIRouter(prefix="/api")

MAX_BOARD_LIST_LIMIT = 100


def _db_path(request: Request) -> Path:
    return request.app.state.db_path


def _check_username(current_user: dict, username: str):
    """Return a 403 JSONResponse if the authenticated user does not match the path username, else None."""
    if current_user["username"] != username:
        return JSONResponse(
            status_code=403,
            content=error_payload("FORBIDDEN", "Access denied."),
        )
    return None


# ---------------------------------------------------------------------------
# Legacy single-board endpoints (backward compat -- now require auth)
# ---------------------------------------------------------------------------

@router.get("/users/{username}/board", response_model=BoardResponse)
def get_board(
    username: str,
    request: Request,
    current_user: dict = Depends(get_current_user),
) -> BoardResponse:
    err = _check_username(current_user, username)
    if err:
        return err
    board = get_or_create_board_for_user(_db_path(request), username)
    return BoardResponse(username=username, board=board)


@router.put("/users/{username}/board", response_model=BoardResponse)
def put_board(
    username: str,
    board: BoardData,
    request: Request,
    current_user: dict = Depends(get_current_user),
) -> BoardResponse:
    err = _check_username(current_user, username)
    if err:
        return err
    saved_board = save_board_for_user(_db_path(request), username, board)
    return BoardResponse(username=username, board=saved_board)


# ---------------------------------------------------------------------------
# Multi-board endpoints
# ---------------------------------------------------------------------------

@router.get("/users/{username}/boards", response_model=BoardListResponse)
def list_boards(
    username: str,
    request: Request,
    current_user: dict = Depends(get_current_user),
    limit: int = 50,
    offset: int = 0,
) -> BoardListResponse:
    err = _check_username(current_user, username)
    if err:
        return err
    boards_data = list_boards_for_user(_db_path(request), username)
    clamped_limit = max(1, min(limit, MAX_BOARD_LIST_LIMIT))
    clamped_offset = max(0, offset)
    page = boards_data[clamped_offset : clamped_offset + clamped_limit]
    summaries = [
        BoardSummary(
            id=b["id"],
            name=b["name"],
            is_default=b["is_default"],
            created_at=b["created_at"],
            updated_at=b["updated_at"],
        )
        for b in page
    ]
    return BoardListResponse(username=username, boards=summaries)


class CreateBoardRequest(BaseModel):
    name: str


@router.post("/users/{username}/boards", response_model=NamedBoardResponse, status_code=201)
def create_board(
    username: str,
    body: CreateBoardRequest,
    request: Request,
    current_user: dict = Depends(get_current_user),
) -> NamedBoardResponse:
    err = _check_username(current_user, username)
    if err:
        return err
    if not body.name or not body.name.strip():
        return JSONResponse(
            status_code=400,
            content=error_payload("VALIDATION_ERROR", "Board name is required."),
        )
    db_path = _db_path(request)
    result = create_board_for_user(db_path, username, body.name.strip())

    log_activity(
        db_path,
        result["id"],
        current_user["user_id"],
        "board",
        str(result["id"]),
        "created",
        {"name": body.name.strip()},
    )

    return NamedBoardResponse(
        id=result["id"],
        name=result["name"],
        username=username,
        board=result["board"],
        is_default=result["is_default"],
    )


@router.get("/users/{username}/boards/{board_id}", response_model=NamedBoardResponse)
def get_named_board(
    username: str,
    board_id: int,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    db_path = _db_path(request)
    result = get_named_board_with_access(db_path, current_user["user_id"], board_id)
    if result is None:
        return JSONResponse(
            status_code=404,
            content=error_payload("NOT_FOUND", "Board not found."),
        )
    return NamedBoardResponse(
        id=result["id"],
        name=result["name"],
        username=username,
        board=result["board"],
        is_default=result["is_default"],
    )


@router.put("/users/{username}/boards/{board_id}", response_model=NamedBoardResponse)
def put_named_board(
    username: str,
    board_id: int,
    board: BoardData,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    db_path = _db_path(request)
    require_board_access(board_id, current_user["user_id"], db_path, minimum_role="member")
    saved = save_named_board_with_access(db_path, current_user["user_id"], board_id, board)
    if saved is None:
        return JSONResponse(
            status_code=404,
            content=error_payload("NOT_FOUND", "Board not found."),
        )
    log_activity(
        db_path,
        board_id,
        current_user["user_id"],
        "board",
        str(board_id),
        "updated",
    )

    result = get_named_board_with_access(db_path, current_user["user_id"], board_id)
    if result is None:
        return JSONResponse(
            status_code=404,
            content=error_payload("NOT_FOUND", "Board not found."),
        )
    return NamedBoardResponse(
        id=result["id"],
        name=result["name"],
        username=username,
        board=result["board"],
        is_default=result["is_default"],
    )


class RenameBoardRequest(BaseModel):
    name: str


@router.patch("/users/{username}/boards/{board_id}")
def patch_named_board(
    username: str,
    board_id: int,
    body: RenameBoardRequest,
    request: Request,
    current_user: dict = Depends(get_current_user),
) -> dict:
    err = _check_username(current_user, username)
    if err:
        return err
    if not body.name or not body.name.strip():
        return JSONResponse(
            status_code=400,
            content=error_payload("VALIDATION_ERROR", "Board name is required."),
        )
    db_path = _db_path(request)
    found = rename_board_for_user(db_path, username, board_id, body.name.strip())
    if not found:
        return JSONResponse(
            status_code=404,
            content=error_payload("NOT_FOUND", "Board not found."),
        )
    log_activity(
        db_path,
        board_id,
        current_user["user_id"],
        "board",
        str(board_id),
        "renamed",
        {"name": body.name.strip()},
    )
    return {"status": "ok", "name": body.name.strip()}


@router.delete("/users/{username}/boards/{board_id}", status_code=204)
def delete_named_board(
    username: str,
    board_id: int,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    err = _check_username(current_user, username)
    if err:
        return err
    db_path = _db_path(request)
    deleted = delete_board_for_user(db_path, username, board_id)
    if not deleted:
        return JSONResponse(
            status_code=404,
            content=error_payload("NOT_FOUND", "Board not found."),
        )


class DuplicateBoardRequest(BaseModel):
    name: str


@router.post("/users/{username}/boards/{board_id}/duplicate", response_model=NamedBoardResponse, status_code=201)
def duplicate_board(
    username: str,
    board_id: int,
    body: DuplicateBoardRequest,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    err = _check_username(current_user, username)
    if err:
        return err
    name = body.name.strip() if body.name else ""
    if not name:
        return JSONResponse(
            status_code=400,
            content=error_payload("VALIDATION_ERROR", "Board name is required."),
        )
    db_path = _db_path(request)
    result = duplicate_board_for_user(db_path, username, board_id, name)
    if result is None:
        return JSONResponse(
            status_code=404,
            content=error_payload("NOT_FOUND", "Board not found."),
        )
    log_activity(
        db_path,
        result["id"],
        current_user["user_id"],
        "board",
        str(result["id"]),
        "created",
        {"name": name, "duplicated_from": board_id},
    )
    return NamedBoardResponse(
        id=result["id"],
        name=result["name"],
        username=username,
        board=result["board"],
        is_default=result["is_default"],
    )


@router.get("/users/{username}/boards/{board_id}/stats")
def get_board_stats(
    username: str,
    board_id: int,
    request: Request,
    current_user: dict = Depends(get_current_user),
) -> dict:
    db_path = _db_path(request)
    result = get_named_board_with_access(db_path, current_user["user_id"], board_id)
    if result is None:
        return JSONResponse(
            status_code=404,
            content=error_payload("NOT_FOUND", "Board not found."),
        )
    board = result["board"]
    cards = list(board.cards.values())
    today = date.today().isoformat()
    stats = {
        "total_cards": len(cards),
        "total_columns": len(board.columns),
        "by_priority": {
            "critical": sum(1 for c in cards if c.priority == "critical"),
            "high": sum(1 for c in cards if c.priority == "high"),
            "medium": sum(1 for c in cards if c.priority == "medium"),
            "low": sum(1 for c in cards if c.priority == "low"),
            "none": sum(1 for c in cards if not c.priority),
        },
        "overdue": sum(1 for c in cards if c.due_date and c.due_date < today),
        "has_due_date": sum(1 for c in cards if c.due_date),
        "by_column": {col.title: len(col.cardIds) for col in board.columns},
        "checklist_items": sum(len(c.checklist) for c in cards),
        "checklist_done": sum(
            sum(1 for item in c.checklist if item.done) for c in cards
        ),
    }
    return stats
