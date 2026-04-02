# Code Review -- PM Kanban Board

Reviewed: 2026-04-02

---

## 1. Security

### 1.1 Legacy "password" backdoor in auth
**Files:** `backend/app/auth.py:54-56`, `backend/app/routes/users.py:57-62`

Users created via the old `get_or_create_user_id` (which sets `password_hash = NULL`) can log in with the hardcoded string `"password"`. This means any username ever auto-created is accessible with a known credential. The same pattern is duplicated in the change-password route.

**Suggestion:** Force legacy users to set a password on first login, or at minimum restrict this to a development-only flag. Remove the duplication between `auth.py` login logic and `users.py` change-password logic.

---

### 1.2 No authentication on legacy board endpoints
**Files:** `backend/app/routes/board.py:37-46`

The legacy `GET /api/users/{username}/board` and `PUT /api/users/{username}/board` have no auth at all. Anyone who knows a username can read and overwrite their default board.

**Suggestion:** Add `Depends(get_current_user)` to these endpoints, or deprecate/remove them now that multi-board endpoints exist.

---

### 1.3 No authentication on legacy chat endpoint
**File:** `backend/app/routes/chat.py:36`

`POST /api/users/{username}/chat` has no auth. Any caller can trigger AI requests and modify a user's board.

**Suggestion:** Same as 1.2 -- require authentication.

---

### 1.4 Username path parameter is not validated against the token
**File:** `backend/app/routes/board.py` (multiple endpoints)

Most multi-board endpoints accept `{username}` in the path but do not verify that the authenticated user matches that username. For example, `create_board`, `put_named_board`, `patch_named_board`, and `delete_named_board` all use `get_current_user_optional` and then operate on the path `{username}`. A logged-in user could pass a different username in the URL and operate on another user's boards.

**Suggestion:** Either validate `current_user["username"] == username` (like the dashboard endpoint already does), or remove `{username}` from the URL and derive it from the token.

---

### 1.5 `ai_test` endpoint is fully open
**File:** `backend/app/routes/ai_test.py`

`POST /api/ai/test` accepts arbitrary prompts and forwards them to OpenRouter with no auth, no rate limit, and no input validation. This could be abused to run up API costs.

**Suggestion:** Require auth, or restrict to a development/admin-only mode.

---

### 1.6 Minimum password length is only 4 characters
**Files:** `backend/app/auth.py:40`, `backend/app/routes/users.py:64`

A 4-character minimum is very weak.

**Suggestion:** Consider raising to 8 characters minimum.

---

## 2. Data Integrity & Backend Design

### 2.1 Board JSON blob makes concurrent edits lossy
**Architecture:** The entire board (all columns + all cards) is stored as a single JSON blob. Every save replaces the whole blob. If two users (or the AI chat) save at the same time, the last write wins and the other's changes are silently lost.

**Suggestion:** For an MVP this is acceptable, but be aware of the limitation. If collaboration features grow, consider adding an `updated_at` optimistic lock (reject saves if the row has been updated since the client last fetched).

---

### 2.2 `update_board_json_by_id` bypasses ownership
**File:** `backend/app/db.py:449-456`

This function updates a board without any ownership check. It exists to let members save, but it means any code path that calls it with a valid `board_id` can overwrite any board.

**Suggestion:** The caller (`save_named_board_with_access`) does check access, which is fine. But consider adding a comment or assertion in `update_board_json_by_id` to make the contract explicit.

---

### 2.3 `db.py` is a very large module (~800 lines)
**File:** `backend/app/db.py`

This single file contains the schema, migrations, and all CRUD for users, sessions, boards, board members, comments, and activity. It works, but it is hard to navigate.

**Suggestion:** Consider splitting into separate modules (e.g., `db/schema.py`, `db/users.py`, `db/boards.py`, `db/comments.py`, `db/activity.py`) when the file continues to grow.

---

### 2.4 Migration runs on every startup
**File:** `backend/app/db.py:172-177`

`initialize_database` always runs the full schema creation + `_migrate_database`. This is fine for SQLite but means the migration logic must be idempotent forever.

**Suggestion:** Consider a version tracking mechanism (e.g., a `schema_version` table) to skip migrations that have already been applied.

---

### 2.5 No expired session cleanup
**File:** `backend/app/db.py`

Expired sessions are only deleted when they are validated (`validate_token`). If a user never makes another request, stale sessions accumulate.

**Suggestion:** Add a periodic cleanup or a TTL-based deletion on startup.

---

### 2.6 `get_dashboard` has inline imports and a bare `except`
**File:** `backend/app/routes/activity.py:66-96`

`import json` and `from app.board_models import BoardData` are imported inside the function body. The `except Exception: continue` on line 95-96 swallows any error when parsing a board, making bugs invisible.

**Suggestion:** Move imports to the top. Log or at least narrow the exception type.

---

### 2.7 Inline import in `delete_comment_route`
**File:** `backend/app/routes/comments.py:147`

`from app.db import get_board_owner_id` is imported inside the function, but `get_board_owner_id` is already imported at the top of the `members.py` module. This suggests a copy-paste oversight.

**Suggestion:** Move the import to the top of the file.

---

## 3. API Design

### 3.1 Inconsistent use of `get_current_user` vs `get_current_user_optional`
**Files:** `backend/app/routes/board.py`, `backend/app/routes/comments.py`, `backend/app/routes/members.py`

Some endpoints use `get_current_user` (hard 401 if no token), others use `get_current_user_optional` (gracefully allows unauthenticated access). The board PUT endpoint falls back to the legacy unauthenticated `save_board_for_user` when there is no token, which is confusing.

**Suggestion:** Decide which endpoints require auth and be consistent. Most mutation endpoints should require auth.

---

### 3.2 `put_named_board` has overly complex fallback logic
**File:** `backend/app/routes/board.py:137-182`

The PUT handler has a 4-level fallback: try auth save, then legacy save, then owner lookup, then member lookup. This is fragile.

**Suggestion:** Simplify: require auth for the multi-board PUT, remove the unauthenticated fallback.

---

### 3.3 No pagination on board list
**File:** `backend/app/routes/board.py:53-66`

`list_boards` returns all boards. For power users this could become expensive.

**Suggestion:** Add `limit`/`offset` query parameters.

---

### 3.4 `ChatMessage` role field is unvalidated
**File:** `backend/app/routes/chat.py:22-23`

`role: str` accepts any string. The AI system expects `"user"` or `"assistant"`.

**Suggestion:** Use `Literal["user", "assistant"]` to validate.

---

## 4. Frontend

### 4.1 No error boundary
**File:** `frontend/src/app/page.tsx`

If any component throws during render, the entire app crashes with a white screen. There is no React error boundary.

**Suggestion:** Add a top-level error boundary component that shows a recovery UI.

---

### 4.2 Board saves on every single change (no debouncing)
**File:** `frontend/src/components/KanbanBoard.tsx:85-99`

Every `applyBoardUpdate` immediately calls `persistBoard`, which fires a PUT request. Dragging a card across multiple columns quickly can generate a burst of concurrent requests.

**Suggestion:** Debounce `persistBoard` (e.g., 500ms) so rapid changes are batched into one save.

---

### 4.3 ChatSidebar refetches the board but KanbanBoard does not know
**File:** `frontend/src/components/AuthGate.tsx:222-226`

The `refreshSignal` prop increments after a chat-based board update, which triggers a full board reload in `KanbanBoard`. But if the user was in the middle of an unsaved edit, the reload will overwrite their changes.

**Suggestion:** Show a notification that the board was externally updated, rather than silently reloading.

---

### 4.4 Token stored in localStorage with no expiry check on the client
**File:** `frontend/src/components/AuthGate.tsx:27-34`

If the token expires server-side, the client will keep sending the stale token and get 401 errors without a clear logout flow.

**Suggestion:** On 401 response from any API call, automatically clear the token and redirect to login.

---

### 4.5 Large inline SVGs
**File:** `frontend/src/components/KanbanBoard.tsx:365-368`

SVG icon markup is inlined directly in the JSX (settings gear, search icon, add icon). This adds visual noise and is repeated across components.

**Suggestion:** Extract common icons into a shared icon component or use an icon library.

---

### 4.6 `api.ts` legacy functions are still exported
**File:** `frontend/src/lib/api.ts:248-277`

`fetchBoard`, `saveBoard`, `sendChat`, and helpers like `boardEndpoint`/`chatEndpoint` are legacy single-board functions. They appear unused now that the multi-board API is used everywhere.

**Suggestion:** Verify they are unused and remove them to reduce confusion.

---

### 4.7 No loading/empty states for some panels
**Files:** `frontend/src/components/CommentsSection.tsx`, `frontend/src/components/ActivityFeed.tsx`

If the API call is slow, there is no skeleton or loading indicator in these sub-panels.

**Suggestion:** Add a simple loading state.

---

## 5. Testing

### 5.1 No backend tests for auth, members, comments, activity, or dashboard routes
**File:** `backend/tests/`

Based on `conftest.py` and existing test files, the test suite covers the board API. The newer features (auth, members, comments, activity, dashboard) appear to lack backend test coverage.

**Suggestion:** Add test coverage for these routes, especially the auth and authorization logic.

---

### 5.2 No frontend integration test for the auth flow
**File:** `frontend/tests/`

The login/register flow is a critical path that only has e2e Playwright coverage (if any). A unit test for `AuthGate` with mocked API calls would catch regressions faster.

**Suggestion:** Add a focused test for the login/register/logout cycle.

---

## 6. DevOps / Configuration

### 6.1 Docker container runs as root
**File:** `Dockerfile`

The Python stage does not create a non-root user. The application runs as root inside the container.

**Suggestion:** Add a `RUN adduser` and `USER` directive.

---

### 6.2 No health check in docker-compose
**File:** `docker-compose.yml`

The service has no `healthcheck` directive. Orchestration tools cannot tell if the app is actually ready.

**Suggestion:** Add a healthcheck using `curl http://localhost:8000/api/health`.

---

### 6.3 SQLite data is not persisted across container restarts
**File:** `docker-compose.yml`

There is no volume mount for the `backend/data/` directory. Restarting the container loses all data.

**Suggestion:** Add a volume: `./data:/app/backend/data`.

---

### 6.4 No `.env.example`
There is a `.env` file referenced by docker-compose, but no `.env.example` checked into the repo to document the required variables.

**Suggestion:** Add a `.env.example` with placeholders (`OPENROUTER_API_KEY=your-key-here`).

---

## 7. Minor / Code Quality

| # | File | Issue |
|---|------|-------|
| 7.1 | `backend/app/routes/users.py:70-73` | Direct `sqlite3.connect` call bypasses the `db.py` abstraction layer. Should be a function in `db.py`. |
| 7.2 | `backend/app/board_models.py:27` | `cardIds` uses camelCase while the rest of the Python models use snake_case. This is intentional (matches frontend), but worth a comment. |
| 7.3 | `backend/app/routes/board.py:1` | `from datetime import date` is imported but only used by `get_board_stats`. Minor, but worth noting the unused import if the stats endpoint moves. |
| 7.4 | `frontend/src/lib/kanban.ts` | `createId` uses `Math.random()` which can collide. Consider `crypto.randomUUID()` for better uniqueness. |
| 7.5 | `backend/app/ai_chat.py:58` | `MAX_HISTORY_MESSAGES = 20` is arbitrary with no comment. Document why 20 was chosen. |
| 7.6 | `backend/app/routes/activity.py:35-36` | `limit` and `offset` query params have no upper bound. A client could request `limit=999999`. |
| 7.7 | `frontend/src/components/KanbanBoard.tsx` | The file is ~580 lines. Consider extracting the filter bar and stats row into separate components. |

---

## Summary

The codebase is well-organized for an MVP. The app factory pattern, service layer separation, and Pydantic validation are solid foundations. The main areas to prioritize:

1. **Security (Section 1):** Close the unauthenticated endpoints and the legacy password backdoor. These are the highest-risk items.
2. **Data integrity (2.1):** Be aware of the last-write-wins problem as collaboration grows.
3. **Debounced saves (4.2):** Quick win that will improve both UX and server load.
4. **Docker persistence (6.3):** Critical for any non-demo deployment.
5. **Test coverage (Section 5):** The newer features need tests.
