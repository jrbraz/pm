import json
from pathlib import Path

import httpx
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ValidationError

from app.ai_chat import process_chat
from app.board_service import (
    get_board_for_user,
    get_or_create_board_for_user,
    save_board_for_user,
    save_named_board_for_user,
)
from app.errors import error_payload

router = APIRouter(prefix="/api")


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = []


def _db_path(request: Request) -> Path:
    return request.app.state.db_path


@router.post("/users/{username}/chat")
def chat(username: str, chat_request: ChatRequest, request: Request) -> dict:
    """Legacy chat endpoint using the default board."""
    if not chat_request.message:
        return JSONResponse(
            status_code=400,
            content=error_payload("VALIDATION_ERROR", "message is required."),
        )
    try:
        db_path = _db_path(request)
        board = get_or_create_board_for_user(db_path, username)
        history = [m.model_dump() for m in chat_request.history]
        result = process_chat(board, chat_request.message, history)
        if result.board_updated and result.board is not None:
            save_board_for_user(db_path, username, result.board)
        return {
            "reply": result.reply,
            "board_updated": result.board_updated,
        }
    except (httpx.HTTPStatusError, json.JSONDecodeError, ValidationError, RuntimeError) as exc:
        return JSONResponse(
            status_code=502,
            content=error_payload("AI_ERROR", str(exc)),
        )


@router.post("/users/{username}/boards/{board_id}/chat")
def chat_for_board(username: str, board_id: int, chat_request: ChatRequest, request: Request) -> dict:
    """Chat endpoint scoped to a specific board."""
    if not chat_request.message:
        return JSONResponse(
            status_code=400,
            content=error_payload("VALIDATION_ERROR", "message is required."),
        )
    try:
        db_path = _db_path(request)
        board = get_board_for_user(db_path, username, board_id)
        if board is None:
            return JSONResponse(
                status_code=404,
                content=error_payload("NOT_FOUND", "Board not found."),
            )
        history = [m.model_dump() for m in chat_request.history]
        result = process_chat(board, chat_request.message, history)
        if result.board_updated and result.board is not None:
            save_named_board_for_user(db_path, username, board_id, result.board)
        return {
            "reply": result.reply,
            "board_updated": result.board_updated,
        }
    except (httpx.HTTPStatusError, json.JSONDecodeError, ValidationError, RuntimeError) as exc:
        return JSONResponse(
            status_code=502,
            content=error_payload("AI_ERROR", str(exc)),
        )
