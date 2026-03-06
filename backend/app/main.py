import json
import os
from pathlib import Path

import httpx
from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, ValidationError

from app.ai_chat import process_chat, ChatResult
from app.ai_client import chat_completion
from app.board_models import BoardData, BoardResponse
from app.board_service import get_or_create_board_for_user, save_board_for_user
from app.db import DEFAULT_DB_PATH, initialize_database


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = []


def _resolve_frontend_dist_dir() -> Path:
    env_path = os.getenv("FRONTEND_DIST_DIR")
    if env_path:
        return Path(env_path).resolve()
    return (Path(__file__).resolve().parents[1] / "frontend_dist").resolve()


def _resolve_db_path() -> Path:
    env_path = os.getenv("DB_PATH")
    if env_path:
        return Path(env_path).resolve()
    return DEFAULT_DB_PATH


def _error_payload(code: str, message: str) -> dict[str, dict[str, str]]:
    return {"error": {"code": code, "message": message}}


def create_app(frontend_dist_dir: Path | None = None, db_path: Path | None = None) -> FastAPI:
    app = FastAPI(title="Project Management MVP Backend", version="0.1.0")

    resolved_db_path = db_path.resolve() if db_path is not None else _resolve_db_path()
    initialize_database(resolved_db_path)

    @app.get("/api/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/api/hello")
    def hello() -> dict[str, str]:
        return {"message": "Hello from FastAPI"}

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(_request, _exc: RequestValidationError):
        return JSONResponse(
            status_code=422,
            content=_error_payload("VALIDATION_ERROR", "Request validation failed."),
        )

    @app.get("/api/users/{username}/board", response_model=BoardResponse)
    def get_board(username: str) -> BoardResponse:
        board = get_or_create_board_for_user(resolved_db_path, username)
        return BoardResponse(username=username, board=board)

    @app.put("/api/users/{username}/board", response_model=BoardResponse)
    def put_board(username: str, board: BoardData) -> BoardResponse:
        saved_board = save_board_for_user(resolved_db_path, username, board)
        return BoardResponse(username=username, board=saved_board)

    @app.post("/api/users/{username}/chat")
    def chat(username: str, request: ChatRequest) -> dict:
        if not request.message:
            return JSONResponse(
                status_code=400,
                content=_error_payload("VALIDATION_ERROR", "message is required."),
            )
        try:
            board = get_or_create_board_for_user(resolved_db_path, username)
            history = [m.model_dump() for m in request.history]
            result = process_chat(board, request.message, history)
            if result.board_updated and result.board is not None:
                save_board_for_user(resolved_db_path, username, result.board)
            return {
                "reply": result.reply,
                "board_updated": result.board_updated,
            }
        except (httpx.HTTPStatusError, json.JSONDecodeError, ValidationError, RuntimeError) as exc:
            return JSONResponse(
                status_code=502,
                content=_error_payload("AI_ERROR", str(exc)),
            )

    @app.post("/api/ai/test")
    def ai_test(payload: dict) -> dict:
        prompt = payload.get("prompt", "What is 2+2? Reply with just the number.")
        try:
            result = chat_completion(
                messages=[{"role": "user", "content": prompt}]
            )
            return {"result": result}
        except (httpx.HTTPStatusError, RuntimeError) as exc:
            return JSONResponse(
                status_code=502,
                content=_error_payload("AI_ERROR", str(exc)),
            )

    resolved_frontend_dist_dir = (
        frontend_dist_dir.resolve()
        if frontend_dist_dir is not None
        else _resolve_frontend_dist_dir()
    )

    if resolved_frontend_dist_dir.exists():
        app.mount(
            "/",
            StaticFiles(directory=str(resolved_frontend_dist_dir), html=True),
            name="frontend",
        )
    else:
        @app.get("/", response_class=PlainTextResponse, status_code=503)
        def frontend_not_built() -> str:
            return (
                "Frontend build output not found. Build the frontend and place it at "
                f"{resolved_frontend_dist_dir}"
            )

    return app


app = create_app()
