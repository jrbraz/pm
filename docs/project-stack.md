# Project Stack

Reviewed on 2026-04-02.

This document lists the main technologies currently used in this project.

## Application Architecture

- Frontend: Next.js
- Frontend language: TypeScript
- Frontend UI library: React
- Backend: FastAPI
- Backend language: Python 3.12
- Database: SQLite
- Packaging / runtime container: Docker
- Local orchestration: Docker Compose

## Frontend Stack

- Framework: Next.js `16.1.6`
- UI library: React `19.2.3`
- DOM renderer: React DOM `19.2.3`
- Drag and drop: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`
- Utility for conditional classes: `clsx`
- Styling: Tailwind CSS `v4`
- PostCSS: `@tailwindcss/postcss`
- Type checking: TypeScript `v5`
- Linting: ESLint `v9`
- Next lint config: `eslint-config-next`
- Unit testing: Vitest
- Component testing: Testing Library (`@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`)
- Browser / E2E testing: Playwright
- Test DOM environment: jsdom

## Backend Stack

- Framework: FastAPI
- ASGI server: Uvicorn
- HTTP client: httpx
- Python package manager / environment tool: `uv`
- Data validation / schema modeling: Pydantic
- Persistence: built-in `sqlite3`
- Password hashing: PBKDF2-HMAC-SHA256 via Python standard library
- Session auth: custom token-based session storage in SQLite

## AI Stack

- AI provider gateway: OpenRouter
- Model: `openai/gpt-oss-120b`
- API integration style: OpenAI-compatible chat completions over HTTP

## Dev and Test Tooling

- Backend tests: Pytest
- Backend coverage tool: `pytest-cov`
- Frontend tests: Vitest
- End-to-end tests: Playwright
- NPM lockfile: `package-lock.json`
- Python lockfile: `uv.lock`

## Container and Runtime Stack

- Frontend build image: `node:22-alpine`
- Backend runtime image: `python:3.12-slim`
- Container build: multi-stage Docker build
- Runtime command: `uv run uvicorn app.main:app`
- Persistent local data volume: Docker named volume mounted to `/app/backend/data`

## Project Structure

- Frontend app: `frontend/`
- Backend app: `backend/`
- Cross-platform scripts: `scripts/`
- Project documentation: `docs/`

## Notes

- The frontend is built as a static export and served by the FastAPI backend.
- The backend currently owns API routes and also serves the built frontend at `/`.
- The database is local SQLite and is appropriate for the current MVP scope.
