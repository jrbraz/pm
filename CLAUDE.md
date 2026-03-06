# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Project Management MVP -- a Kanban board web app with AI chat sidebar. Single Docker container serves a FastAPI backend (Python) with a statically-built Next.js frontend. SQLite for persistence. AI powered by OpenRouter (`openai/gpt-oss-120b`).

MVP login: `user` / `password` (hardcoded in frontend AuthGate).

## Commands

### Backend (from `backend/`)
```bash
uv run uvicorn app.main:app --host 127.0.0.1 --port 8000   # run locally
uv run pytest                                                # run all tests
uv run pytest tests/test_board_api.py                        # single test file
uv run pytest tests/test_board_api.py::test_name -v          # single test
```

### Frontend (from `frontend/`)
```bash
npm install          # install deps
npm run dev          # dev server
npm run build        # production build (static export to out/)
npm run lint         # ESLint
npm run test:unit    # Vitest
npm run test:e2e     # Playwright (auto docker compose up/down)
npm run test:all     # unit + e2e
```

### Docker (from project root)
```bash
docker compose up --build -d   # build and start on port 8000
docker compose down            # stop
```

## Architecture

```
pm/
  backend/
    app/
      main.py          -- FastAPI app factory (create_app), all API routes
      db.py            -- SQLite schema bootstrap and persistence helpers
      board_models.py  -- Pydantic models for board data validation
      board_service.py -- board read/write service logic
      ai_client.py     -- OpenRouter chat completion wrapper (httpx)
      ai_chat.py       -- AI chat processing: system prompt, board-aware message building, JSON response parsing
    tests/             -- pytest tests
  frontend/
    src/
      app/             -- Next.js App Router pages (layout, page)
      components/      -- React components: AuthGate, KanbanBoard, KanbanColumn, KanbanCard, ChatSidebar, NewCardForm
      lib/
        kanban.ts      -- board/card types, seed data, card move logic, ID generation
        api.ts         -- backend API client functions
    tests/             -- Playwright e2e specs
  docs/                -- PLAN.md, RUN.md, BACKEND_API.md, DATABASE.md
  scripts/             -- start/stop server scripts for Mac, Windows, Linux
```

### Key architectural patterns

- **App factory**: `backend/app/main.py:create_app()` accepts optional `frontend_dist_dir` and `db_path` for testing. The module-level `app = create_app()` is the production entry point.
- **Board as JSON blob**: The entire board state (columns + cards) is stored as a single JSON text field in SQLite (`boards.board_json`). One board per user, enforced by `UNIQUE` constraint on `user_id`.
- **AI chat flow**: `POST /api/users/{username}/chat` -> loads board -> `process_chat()` builds messages with system prompt + board state + history -> calls OpenRouter -> parses JSON response -> optionally saves updated board.
- **Frontend static export**: Next.js builds to `frontend/out/`, copied to `backend/frontend_dist/` in Docker. FastAPI mounts it as static files at `/`.
- **Environment**: `OPENROUTER_API_KEY` (or `openrouter_api_key`) from `.env`. `DB_PATH` overrides default `backend/data/pm.db`. `FRONTEND_DIST_DIR` overrides frontend path.

## API Endpoints

- `GET /api/health` -- health check
- `GET /api/users/{username}/board` -- get or create board
- `PUT /api/users/{username}/board` -- replace board
- `POST /api/users/{username}/chat` -- AI chat (body: `{message, history}`)
- `POST /api/ai/test` -- test AI connectivity

## Coding Standards

- Never over-engineer. Keep it simple. No unnecessary defensive programming.
- No emojis in code or docs.
- Use latest library versions and idiomatic approaches.
- Identify root cause before fixing issues -- prove with evidence, then fix.
- Python: `uv` for package management, Python 3.12+.
- Frontend: React 19, Next.js 16, Tailwind CSS v4, TypeScript, `@dnd-kit` for drag-and-drop.
- Test focus: valuable tests over coverage targets. Don't add tests just to hit metrics.

## Color Scheme

- Accent Yellow: `#ecad0a`
- Blue Primary: `#209dd7`
- Purple Secondary: `#753991`
- Dark Navy: `#032147`
- Gray Text: `#888888`
