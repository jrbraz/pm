from pathlib import Path

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.auth import hash_password, verify_password
from app.db import get_user_by_username, search_users
from app.deps import get_current_user
from app.errors import error_payload

router = APIRouter(prefix="/api/users")


def _db_path(request: Request) -> Path:
    return request.app.state.db_path


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


@router.get("/{username}/profile")
def get_profile(username: str, request: Request) -> dict:
    user = get_user_by_username(_db_path(request), username)
    if user is None:
        return JSONResponse(
            status_code=404,
            content=error_payload("NOT_FOUND", "User not found."),
        )
    return {
        "username": user["username"],
        "id": user["id"],
        "has_password": bool(user.get("password_hash")),
    }


@router.post("/{username}/change-password")
def change_password(username: str, body: ChangePasswordRequest, request: Request) -> dict:
    db_path = _db_path(request)
    user = get_user_by_username(db_path, username)
    if user is None:
        return JSONResponse(
            status_code=404,
            content=error_payload("NOT_FOUND", "User not found."),
        )

    stored_hash = user.get("password_hash")
    if stored_hash:
        if not verify_password(body.current_password, stored_hash):
            return JSONResponse(
                status_code=401,
                content=error_payload("AUTH_ERROR", "Current password is incorrect."),
            )
    else:
        # Legacy user without password
        if body.current_password != "password":
            return JSONResponse(
                status_code=401,
                content=error_payload("AUTH_ERROR", "Current password is incorrect."),
            )

    if len(body.new_password) < 4:
        return JSONResponse(
            status_code=400,
            content=error_payload("VALIDATION_ERROR", "New password must be at least 4 characters."),
        )

    import sqlite3
    new_hash = hash_password(body.new_password)
    with sqlite3.connect(db_path) as conn:
        conn.execute(
            "UPDATE users SET password_hash = ? WHERE username = ?",
            (new_hash, username),
        )
        conn.commit()

    return {"status": "ok", "message": "Password changed successfully."}


# Search must be registered BEFORE /{username}/... routes to avoid conflicts.
# This route is on the router with prefix="/api/users" so the full path is /api/users/search
@router.get("/search")
def search_users_route(
    q: str = "",
    request: Request = None,
    current_user: dict = Depends(get_current_user),
) -> list:
    if not q or len(q) < 1:
        return []
    db_path = request.app.state.db_path
    results = search_users(db_path, q, limit=10)
    return results
