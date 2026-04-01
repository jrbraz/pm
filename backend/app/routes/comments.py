from pathlib import Path

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.db import (
    create_comment,
    delete_comment,
    get_comment_by_id,
    get_comments_for_card,
    log_activity,
    update_comment,
)
from app.deps import get_current_user, require_board_access
from app.errors import error_payload

router = APIRouter(prefix="/api")


def _db(request: Request) -> Path:
    return request.app.state.db_path


# ---------------------------------------------------------------------------
# Card comments
# ---------------------------------------------------------------------------

@router.get("/users/{username}/boards/{board_id}/cards/{card_id}/comments")
def list_comments(
    username: str,
    board_id: int,
    card_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user),
) -> dict:
    db_path = _db(request)
    require_board_access(board_id, current_user["user_id"], db_path, minimum_role="viewer")
    comments = get_comments_for_card(db_path, board_id, card_id)
    return {"board_id": board_id, "card_id": card_id, "comments": comments}


class CreateCommentRequest(BaseModel):
    body: str


@router.post("/users/{username}/boards/{board_id}/cards/{card_id}/comments", status_code=201)
def post_comment(
    username: str,
    board_id: int,
    card_id: str,
    body: CreateCommentRequest,
    request: Request,
    current_user: dict = Depends(get_current_user),
) -> dict:
    db_path = _db(request)
    require_board_access(board_id, current_user["user_id"], db_path, minimum_role="member")

    if not body.body or not body.body.strip():
        return JSONResponse(
            status_code=400,
            content=error_payload("VALIDATION_ERROR", "Comment body cannot be empty."),
        )

    comment_id = create_comment(
        db_path, board_id, card_id, current_user["user_id"], body.body.strip()
    )

    log_activity(
        db_path,
        board_id,
        current_user["user_id"],
        "comment",
        card_id,
        "commented",
        {"comment_id": comment_id},
    )

    comment = get_comment_by_id(db_path, comment_id)
    return comment


class UpdateCommentRequest(BaseModel):
    body: str


@router.patch("/users/{username}/boards/{board_id}/cards/{card_id}/comments/{comment_id}")
def patch_comment(
    username: str,
    board_id: int,
    card_id: str,
    comment_id: int,
    body: UpdateCommentRequest,
    request: Request,
    current_user: dict = Depends(get_current_user),
) -> dict:
    db_path = _db(request)
    require_board_access(board_id, current_user["user_id"], db_path, minimum_role="member")

    comment = get_comment_by_id(db_path, comment_id)
    if comment is None or comment["board_id"] != board_id or comment["card_id"] != card_id:
        return JSONResponse(
            status_code=404,
            content=error_payload("NOT_FOUND", "Comment not found."),
        )

    # Only the comment author can edit
    if comment["user_id"] != current_user["user_id"]:
        return JSONResponse(
            status_code=403,
            content=error_payload("FORBIDDEN", "You can only edit your own comments."),
        )

    if not body.body or not body.body.strip():
        return JSONResponse(
            status_code=400,
            content=error_payload("VALIDATION_ERROR", "Comment body cannot be empty."),
        )

    update_comment(db_path, comment_id, body.body.strip())
    return get_comment_by_id(db_path, comment_id)


@router.delete(
    "/users/{username}/boards/{board_id}/cards/{card_id}/comments/{comment_id}",
    status_code=204,
)
def delete_comment_route(
    username: str,
    board_id: int,
    card_id: str,
    comment_id: int,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    db_path = _db(request)
    require_board_access(board_id, current_user["user_id"], db_path, minimum_role="member")

    comment = get_comment_by_id(db_path, comment_id)
    if comment is None or comment["board_id"] != board_id or comment["card_id"] != card_id:
        return JSONResponse(
            status_code=404,
            content=error_payload("NOT_FOUND", "Comment not found."),
        )

    # Comment author OR board owner can delete
    from app.db import get_board_owner_id
    owner_id = get_board_owner_id(db_path, board_id)
    if comment["user_id"] != current_user["user_id"] and owner_id != current_user["user_id"]:
        return JSONResponse(
            status_code=403,
            content=error_payload("FORBIDDEN", "You can only delete your own comments."),
        )

    delete_comment(db_path, comment_id)
