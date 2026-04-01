from pathlib import Path

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.auth import login_user, logout_user, register_user
from app.errors import error_payload

router = APIRouter(prefix="/api/auth")


def _db_path(request: Request) -> Path:
    return request.app.state.db_path


class RegisterRequest(BaseModel):
    username: str
    password: str


class LoginRequest(BaseModel):
    username: str
    password: str


@router.post("/register")
def register(body: RegisterRequest, request: Request) -> dict:
    try:
        user = register_user(_db_path(request), body.username, body.password)
        return {"username": user["username"], "id": user["id"]}
    except ValueError as exc:
        return JSONResponse(
            status_code=400,
            content=error_payload("REGISTRATION_ERROR", str(exc)),
        )


@router.post("/login")
def login(body: LoginRequest, request: Request) -> dict:
    try:
        token = login_user(_db_path(request), body.username, body.password)
        return {"token": token, "username": body.username}
    except ValueError:
        return JSONResponse(
            status_code=401,
            content=error_payload("AUTH_ERROR", "Invalid username or password."),
        )


@router.post("/logout")
def logout(request: Request) -> dict:
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
        logout_user(_db_path(request), token)
    return {"status": "ok"}
