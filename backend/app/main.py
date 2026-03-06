import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles

from app.db import DEFAULT_DB_PATH, initialize_database
from app.errors import error_payload
from app.routes import ai_test, board, chat, health


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


def create_app(frontend_dist_dir: Path | None = None, db_path: Path | None = None) -> FastAPI:
    app = FastAPI(title="Project Management MVP Backend", version="0.1.0")

    resolved_db_path = db_path.resolve() if db_path is not None else _resolve_db_path()
    initialize_database(resolved_db_path)
    app.state.db_path = resolved_db_path

    app.include_router(health.router)
    app.include_router(board.router)
    app.include_router(chat.router)
    app.include_router(ai_test.router)

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(_request, _exc: RequestValidationError):
        return JSONResponse(
            status_code=422,
            content=error_payload("VALIDATION_ERROR", "Request validation failed."),
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
