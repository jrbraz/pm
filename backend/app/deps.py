from fastapi import HTTPException, Request

from app.auth import validate_token
from app.db import get_effective_role
from app.errors import error_payload

ROLE_LEVELS = {"viewer": 0, "member": 1, "owner": 2}


def _extract_token(request: Request) -> str | None:
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return auth[7:]
    return None


def get_current_user(request: Request) -> dict:
    """Require a valid Bearer token. Returns {user_id, username}. Raises 401 otherwise."""
    token = _extract_token(request)
    if not token:
        raise HTTPException(
            status_code=401,
            detail=error_payload("UNAUTHORIZED", "Authentication required."),
        )
    session = validate_token(request.app.state.db_path, token)
    if session is None:
        raise HTTPException(
            status_code=401,
            detail=error_payload("UNAUTHORIZED", "Invalid or expired token."),
        )
    return session


def get_current_user_optional(request: Request) -> dict | None:
    """Extract the current user if a valid token is present, else None."""
    token = _extract_token(request)
    if not token:
        return None
    return validate_token(request.app.state.db_path, token)


def require_board_access(
    board_id: int,
    user_id: int,
    db_path,
    minimum_role: str = "viewer",
) -> str:
    """
    Check that user_id has at least minimum_role on board_id.
    Returns the effective role string.
    Raises HTTPException 403 if access denied, 404 if board not found.
    """
    role = get_effective_role(db_path, board_id, user_id)
    if role is None:
        raise HTTPException(
            status_code=404,
            detail=error_payload("NOT_FOUND", "Board not found."),
        )
    if ROLE_LEVELS.get(role, -1) < ROLE_LEVELS.get(minimum_role, 0):
        raise HTTPException(
            status_code=403,
            detail=error_payload("FORBIDDEN", "Insufficient board access."),
        )
    return role
