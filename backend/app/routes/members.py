import json
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.db import (
    add_board_member,
    get_board_members,
    get_board_owner_id,
    get_effective_role,
    get_member_role,
    get_user_by_username,
    log_activity,
    remove_board_member,
    update_member_role,
)
from app.deps import get_current_user, require_board_access
from app.errors import error_payload

router = APIRouter(prefix="/api")


def _db(request: Request) -> Path:
    return request.app.state.db_path


# ---------------------------------------------------------------------------
# Board members
# ---------------------------------------------------------------------------

@router.get("/users/{username}/boards/{board_id}/members")
def list_members(
    username: str,
    board_id: int,
    request: Request,
    current_user: dict = Depends(get_current_user),
) -> dict:
    db_path = _db(request)
    require_board_access(board_id, current_user["user_id"], db_path, minimum_role="viewer")
    members = get_board_members(db_path, board_id)
    owner_id = get_board_owner_id(db_path, board_id)
    return {"board_id": board_id, "owner_user_id": owner_id, "members": members}


class AddMemberRequest(BaseModel):
    username: str
    role: Literal["member", "viewer"] = "member"


@router.post("/users/{username}/boards/{board_id}/members", status_code=201)
def add_member(
    username: str,
    board_id: int,
    body: AddMemberRequest,
    request: Request,
    current_user: dict = Depends(get_current_user),
) -> dict:
    db_path = _db(request)
    require_board_access(board_id, current_user["user_id"], db_path, minimum_role="owner")

    invite_user = get_user_by_username(db_path, body.username)
    if invite_user is None:
        return JSONResponse(
            status_code=404,
            content=error_payload("NOT_FOUND", f"User '{body.username}' not found."),
        )

    # Owner cannot be added as a member
    owner_id = get_board_owner_id(db_path, board_id)
    if invite_user["id"] == owner_id:
        return JSONResponse(
            status_code=409,
            content=error_payload("CONFLICT", "Board owner cannot be added as a member."),
        )

    existing = get_member_role(db_path, board_id, invite_user["id"])
    if existing is not None:
        return JSONResponse(
            status_code=409,
            content=error_payload("CONFLICT", "User is already a member of this board."),
        )

    try:
        add_board_member(db_path, board_id, invite_user["id"], body.role, current_user["user_id"])
    except ValueError as exc:
        return JSONResponse(status_code=409, content=error_payload("CONFLICT", str(exc)))

    log_activity(
        db_path,
        board_id,
        current_user["user_id"],
        "member",
        body.username,
        "invited",
        {"role": body.role},
    )

    return {"status": "ok", "username": body.username, "role": body.role}


class UpdateMemberRoleRequest(BaseModel):
    role: Literal["member", "viewer"]


@router.patch("/users/{username}/boards/{board_id}/members/{member_username}")
def patch_member_role(
    username: str,
    board_id: int,
    member_username: str,
    body: UpdateMemberRoleRequest,
    request: Request,
    current_user: dict = Depends(get_current_user),
) -> dict:
    db_path = _db(request)
    require_board_access(board_id, current_user["user_id"], db_path, minimum_role="owner")

    target = get_user_by_username(db_path, member_username)
    if target is None:
        return JSONResponse(
            status_code=404,
            content=error_payload("NOT_FOUND", f"User '{member_username}' not found."),
        )

    updated = update_member_role(db_path, board_id, target["id"], body.role)
    if not updated:
        return JSONResponse(
            status_code=404,
            content=error_payload("NOT_FOUND", "Member not found on this board."),
        )

    log_activity(
        db_path,
        board_id,
        current_user["user_id"],
        "member",
        member_username,
        "role_changed",
        {"new_role": body.role},
    )
    return {"status": "ok", "username": member_username, "role": body.role}


@router.delete("/users/{username}/boards/{board_id}/members/{member_username}", status_code=204)
def remove_member(
    username: str,
    board_id: int,
    member_username: str,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    db_path = _db(request)
    # Allow owner to remove anyone, or self-removal by a member
    role = get_effective_role(db_path, board_id, current_user["user_id"])
    if role is None:
        return JSONResponse(
            status_code=404,
            content=error_payload("NOT_FOUND", "Board not found."),
        )

    # If removing someone else, must be owner
    if member_username != current_user["username"] and role != "owner":
        return JSONResponse(
            status_code=403,
            content=error_payload("FORBIDDEN", "Only the board owner can remove other members."),
        )

    target = get_user_by_username(db_path, member_username)
    if target is None:
        return JSONResponse(
            status_code=404,
            content=error_payload("NOT_FOUND", f"User '{member_username}' not found."),
        )

    removed = remove_board_member(db_path, board_id, target["id"])
    if not removed:
        return JSONResponse(
            status_code=404,
            content=error_payload("NOT_FOUND", "Member not found on this board."),
        )

    log_activity(
        db_path,
        board_id,
        current_user["user_id"],
        "member",
        member_username,
        "removed",
    )
