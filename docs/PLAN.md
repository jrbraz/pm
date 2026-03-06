# Project Plan (MVP)

This document defines the execution plan for the Project Management MVP and acts as the check-off list while implementing.

## Quality Gates (applies to all parts after test framework is in place)

- [ ] Prioritize high-value tests; target ~80% unit coverage when sensible, but do not add low-value tests only to hit a number.
- [ ] Integration testing is robust for each part's user-facing or API behavior.
- [ ] Root cause is identified and evidenced before fixes when issues occur.
- [ ] Scope is kept strictly MVP (no extra features).

## Implemented Design Decisions (through Part 7)

- Runtime architecture: one Dockerized FastAPI app serves API routes under `/api/...` and serves built Next.js static assets at `/`.
- Auth for MVP: frontend-only hardcoded gate (`user` / `password`) with local session state; backend remains username-driven for future real auth.
- Persistence model: SQLite with `users` and `boards` tables, with one board per user enforced by `boards.user_id UNIQUE`.
- Board storage format: full board state is stored as JSON text (`board_json`) for simple MVP read/replace operations.
- DB bootstrap: schema and DB file are auto-created on startup if missing; default path is `backend/data/pm.db`, override via `DB_PATH`.
- Board read behavior: `GET /api/users/{username}/board` creates missing user and default board on first access.
- Board write behavior: `PUT /api/users/{username}/board` accepts full-board replacement payload validated against typed schema.
- Validation contract: request validation failures are normalized to `422` with `{"error":{"code":"VALIDATION_ERROR","message":"Request validation failed."}}`.
- Frontend persistence integration: Kanban loads from backend after login and persists rename/add/edit/delete/move actions through API writes.
- End-to-end strategy: Playwright tests target `http://127.0.0.1:8000` and run against Docker Compose via a wrapper that brings the stack up/down.
- Test policy refinement: keep coverage target as a guideline, and prefer fewer high-value unit/integration tests over low-value tests written only to raise coverage.
- AI connectivity: backend uses `httpx` to call OpenRouter's OpenAI-compatible API directly at `https://openrouter.ai/api/v1/chat/completions`; API key read from `OPENROUTER_API_KEY` or `openrouter_api_key` env var; `.env` passed to container via `env_file` in `docker-compose.yml`.
- AI chat contract: `POST /api/users/{username}/chat` accepts `{"message": "...", "history": [...]}`, sends board + history + message to model, expects JSON `{"reply": "...", "board_update": null | BoardData}`. Board updates are validated against `BoardData` schema (including card reference checks) before saving. Invalid model output raises an error to the caller.
- Sidebar chat UI: `ChatSidebar` component renders alongside `KanbanBoard` in a flex layout within `AuthGate`. Conversation history is kept in component state. When the AI updates the board (`board_updated: true`), a `refreshSignal` prop triggers `KanbanBoard` to re-fetch from the backend.

## Part 1: Planning and Baseline Documentation

### Checklist
- [x] Expand this file into a detailed, checkable implementation plan with tests and success criteria.
- [x] Create `frontend/AGENTS.md` documenting the current frontend codebase and workflows.
- [x] Get explicit user approval for this plan before starting Part 2.

### Tests
- Plan and docs review by user (manual validation).

### Success Criteria
- `docs/PLAN.md` is concrete enough to execute without re-planning.
- `frontend/AGENTS.md` accurately describes current frontend state.
- User explicitly approves plan continuation.

## Part 2: Scaffolding (Docker + FastAPI + Scripts)

### Checklist
- [x] Create backend FastAPI service in `backend/` with health route and example API route.
- [x] Create minimal static HTML response served by backend for scaffolding verification.
- [x] Add Dockerfile and compose configuration for local run.
- [x] Use `uv` for Python dependency management in container build and runtime commands.
- [x] Add start/stop scripts for Windows, macOS, and Linux in `scripts/`.
- [x] Document local run commands briefly.

### Tests
- [x] Backend unit tests for health/example endpoints.
- [x] Container smoke test: build and run successfully.
- [x] Integration test: static page loads and example API call succeeds via container.

### Success Criteria
- `docker compose up` starts app locally.
- `/` returns scaffold page from FastAPI.
- Example API endpoint returns expected JSON.
- Cross-platform start/stop scripts work as documented.

## Part 3: Serve Existing Frontend from Backend

### Checklist
- [x] Add frontend build stage and static asset serving through FastAPI at `/`.
- [x] Ensure current Kanban demo renders from served static build.
- [x] Remove scaffold-only page path from primary route.
- [x] Keep backend route namespace clean (for example `/api/...`).

### Tests
- [x] Frontend unit tests pass with meaningful coverage for touched frontend behavior.
- [x] Backend tests still pass.
- [x] Integration test: built frontend is served by backend and Kanban renders.

### Success Criteria
- Browser at `/` shows demo Kanban board from built frontend.
- Static asset loading works from backend server.
- No regression in existing frontend behavior.

## Part 4: Fake Sign-In Flow

### Checklist
- [x] Add login screen at `/` gate using hardcoded credentials (`user` / `password`).
- [x] Add simple logged-in state and logout flow.
- [x] Keep implementation minimal and compatible with later backend auth replacement.
- [x] Ensure unauthenticated users cannot see board content.

### Tests
- [x] Unit tests for login form validation and state transitions.
- [x] Integration tests for login success, login failure, logout, and route gating.
- [x] Coverage is reviewed for touched frontend code (target ~80% when sensible).

### Success Criteria
- Correct credentials show board.
- Incorrect credentials do not log in.
- Logout returns user to login screen and clears local auth state.

## Part 5: Database Modeling (Kanban as JSON)

### Checklist
- [x] Propose SQLite schema supporting multi-user future with one-board-per-user MVP behavior.
- [x] Store board state as JSON payload with timestamps.
- [x] Add migration/bootstrap logic to create DB and schema if missing.
- [x] Write database design doc in `docs/` and request user sign-off before implementation beyond schema setup.

### Tests
- [x] Backend unit tests for schema creation and persistence operations.
- [x] Integration test for DB auto-create on first run.

### Success Criteria
- Schema is documented and approved.
- DB file is created automatically when absent.
- Schema supports future multi-user extension without redesign.

## Part 6: Backend Kanban API

### Checklist
- [x] Implement API endpoints to fetch and update board for signed-in user.
- [x] Add validation for payload shape.
- [x] Add consistent error responses.
- [x] Ensure persistence layer reads/writes SQLite JSON board correctly.

### Tests
- [x] Backend unit tests for service/repository logic.
- [x] API integration tests for successful fetch/update and error cases.
- [x] Coverage is reviewed for touched backend code (target ~80% when sensible).

### Success Criteria
- API supports read/write of board state for MVP user.
- DB persistence works across restarts.
- Invalid payloads are safely rejected with clear status codes.

## Part 7: Frontend + Backend Integration

### Checklist
- [x] Replace frontend local-only board state initialization with backend API fetch.
- [x] Persist column rename/card add/edit/delete/move through backend API.
- [x] Add loading and error UX states that remain simple and clear.
- [x] Preserve existing drag-and-drop UX while wiring persistence.

### Tests
- [x] Frontend unit tests for API client/state updates.
- [x] End-to-end integration tests for persisted board changes.
- [x] Coverage is reviewed for touched frontend code (target ~80% when sensible).

### Success Criteria
- Board mutations persist after refresh/restart.
- Frontend reflects backend state accurately.
- Core Kanban interactions remain stable.

## Part 8: OpenRouter Connectivity

### Checklist
- [x] Add backend OpenRouter client using `OPENROUTER_API_KEY` and model `openai/gpt-oss-120b`.
- [x] Create a minimal internal test route/service call to validate connectivity.
- [x] Keep request/response logging safe (no key leakage).

### Tests
- [x] Unit tests for AI client request composition and response parsing (with mocks).
- [x] Integration smoke test for `2+2` prompt round trip.
- [x] Coverage is reviewed for touched backend code (target ~80% when sensible).

### Success Criteria
- Backend can successfully call OpenRouter with configured model.
- Connectivity test returns expected semantic result.
- Failures are handled with clear error messages.

## Part 9: Structured AI Board Operations

### Checklist
- [x] Define structured output schema for chat response and optional board update.
- [x] Send current board JSON + user message + history to model.
- [x] Validate model output against schema before applying updates.
- [x] Apply accepted board updates transactionally to DB.

### Tests
- [x] Unit tests for schema validation and board patch application.
- [x] Integration tests for: chat-only response, response with board update, invalid model payload handling.
- [x] Coverage is reviewed for touched backend code (target ~80% when sensible).

### Success Criteria
- AI responses are parsed deterministically.
- Optional board update path is safe and validated.
- Conversation history is included and persisted as required for MVP behavior.

## Part 10: Sidebar AI Chat UI

### Checklist
- [x] Add sidebar chat UI integrated with backend AI endpoint.
- [x] Show conversation history and pending states.
- [x] Refresh board automatically after AI-applied updates.
- [x] Keep UI aligned to project color scheme and existing style direction.

### Tests
- [x] Frontend unit tests for chat components and state transitions.
- [ ] End-to-end integration tests for chat send/receive and AI-driven board update rendering.
- [x] Coverage is reviewed for touched frontend code (target ~80% when sensible).

### Success Criteria
- User can chat from sidebar and receive AI responses.
- AI-triggered board changes appear automatically without manual refresh.
- Main Kanban interactions remain functional alongside chat.
