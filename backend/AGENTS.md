# Backend Agent Guide

## Purpose

This directory contains the FastAPI backend for the Project Management MVP.

## Scope

- Serve statically built Next.js frontend assets at `/`.
- API endpoints under `/api/` for health, board CRUD, AI chat, and AI connectivity testing.
- Bootstrap SQLite database schema automatically on app startup.
- DB-layer helpers for user and board JSON persistence.
- AI chat integration via OpenRouter.

## Structure

- `app/main.py`: App factory (`create_app`), validation handler, static frontend mounting.
- `app/routes/health.py`: `GET /api/health`, `GET /api/hello`.
- `app/routes/board.py`: `GET/PUT /api/users/{username}/board`.
- `app/routes/chat.py`: `POST /api/users/{username}/chat`, `ChatRequest`/`ChatMessage` models.
- `app/routes/ai_test.py`: `POST /api/ai/test`.
- `app/errors.py`: Shared error response helper.
- `app/board_models.py`: Pydantic models and board validation (including orphan card detection).
- `app/board_service.py`: Board read/write service logic.
- `app/db.py`: SQLite schema and persistence helpers.
- `app/ai_client.py`: OpenRouter chat completion wrapper.
- `app/ai_chat.py`: AI chat processing with history truncation.
- `tests/conftest.py`: Shared test fixtures (`client`, `FIXTURE_DIR`).
- `tests/test_*.py`: Test modules.
- `pyproject.toml`: Python project metadata and dependencies managed with `uv`.

## Notes

- Routes are `APIRouter` instances in `app/routes/`, included by the app factory.
- DB path is stored on `app.state.db_path` and accessed by routes via `request.app.state.db_path`.
- Route namespace: `/api/*` for API endpoints.
