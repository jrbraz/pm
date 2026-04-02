# Code Review Report

Comprehensive review of the full repository as of the completion of Part 10 (all MVP parts implemented).

## Summary

The codebase is well-structured, consistent, and functional. The backend and frontend are cleanly separated with clear API boundaries. Test coverage is solid and tests pass.

All findings from the initial review have been remediated. See the Remediation Status section at the end for details.

Findings are grouped by severity: **High** (should fix before sharing/deploying), **Medium** (should fix soon), **Low** (nice to have).

---

## High Severity

### H1. API key in `.env` file [VERIFIED NOT IN GIT]

**File:** `.env`
**Original concern:** The OpenRouter API key might be in git history.
**Verified:** `.env` has never been committed to git (`git log --all --full-history -- .env` returns empty). The `.gitignore` correctly excludes it. No action needed.

### H2. No backend authentication -- any user can read/write any other user's board [DOCUMENTED]

**File:** `backend/app/main.py`
**Issue:** The `{username}` path parameter is trusted directly.
**Remediation:** Added explicit security note to `AGENTS.md` documenting this as a known MVP limitation. Must be addressed before any network-exposed or multi-user deployment.

### H3. Broad `except Exception` swallows all errors in chat and AI test routes [FIXED]

**Files:** `backend/app/main.py`
**Remediation:** Narrowed exception handling to catch only `httpx.HTTPStatusError`, `json.JSONDecodeError`, `ValidationError`, and `RuntimeError`. Unexpected exceptions now propagate to FastAPI's default 500 handler.

---

## Medium Severity

### M1. Chat endpoint accepts untyped `dict` payload -- no validation [FIXED]

**File:** `backend/app/main.py`
**Remediation:** Added `ChatRequest` and `ChatMessage` Pydantic models. The chat endpoint now uses `request: ChatRequest` instead of `payload: dict`, giving automatic validation consistent with other endpoints.

### M2. Column rename fires a PUT on every keystroke [FIXED]

**File:** `frontend/src/components/KanbanColumn.tsx`
**Remediation:** Added local title state with 400ms debounce timer. The rename callback fires on timeout or on blur, reducing network calls from one-per-keystroke to one-per-pause.

### M3. `persistBoard` called inside `setBoard` updater -- async side effect in setState [FIXED]

**File:** `frontend/src/components/KanbanBoard.tsx`
**Remediation:** Refactored `applyBoardUpdate` to use a ref for current board state. Board update and persist call now happen outside the setState updater function.

### M4. `initialData` in `frontend/src/lib/kanban.ts` is dead code [FIXED]

**File:** `frontend/src/lib/kanban.ts`
**Remediation:** Removed `initialData` export. Created lightweight test-local board fixtures in `KanbanBoard.test.tsx` and `api.test.ts`.

### M5. No `conftest.py` -- test setup is duplicated across backend test files [FIXED]

**Files:** `backend/tests/`
**Remediation:** Created `backend/tests/conftest.py` with shared `sys.path` setup, `FIXTURE_DIR` constant, and `client` pytest fixture (with isolated `tmp_path` DB). Removed duplicated boilerplate from all 7 test files.

### M6. Chat history grows unbounded in the AI request [FIXED]

**File:** `backend/app/ai_chat.py`
**Remediation:** Added `MAX_HISTORY_MESSAGES = 20` constant. `build_messages` now truncates history to the last 20 messages before sending to the model. Added a test verifying truncation.

---

## Low Severity

### L1. Logout button position uses hardcoded `right: 370px` [FIXED]

**File:** `frontend/src/components/AuthGate.tsx`
**Remediation:** Changed to `right-6` within a `relative` parent container, so the button positions relative to the board area rather than depending on sidebar width.

### L2. Chat message list uses array index as React key [FIXED]

**File:** `frontend/src/components/ChatSidebar.tsx`
**Remediation:** Added a `DisplayMessage` type with unique `id` field. Each message gets a generated ID via an incrementing counter. The map now uses `msg.id` as key.

### L3. `test_main.py` creates a new app instance per test without `tmp_path` for DB [FIXED]

**File:** `backend/tests/test_main.py`
**Remediation:** All tests now use the shared `client` fixture from `conftest.py` which provides an isolated `tmp_path` database. The 503 test also uses `tmp_path`.

### L4. Frontend `next.config.ts` not reviewed -- could affect static export [VERIFIED OK]

**Verified:** `frontend/next.config.ts` exists and contains `output: "export"`. No action needed.

### L5. `.dockerignore` doesn't exclude `CLAUDE.md` and `AGENTS.md` [FIXED]

**File:** `.dockerignore`
**Remediation:** Added `*.md`, `CLAUDE.md`, `AGENTS.md`, and `PROMPTS.md` to `.dockerignore`.

### L6. `_get_api_key` is imported and tested but is a private function [FIXED]

**File:** `backend/app/ai_client.py`
**Remediation:** Renamed `_get_api_key` to `get_api_key` (public). Updated the internal call site and test imports.

### L7. Orphan cards are silently allowed in board state [FIXED]

**File:** `backend/app/board_models.py`
**Remediation:** Extended `validate_column_card_references` to also check that every card in the `cards` dict is referenced by at least one column. Orphan cards now raise a `ValueError`.

---

## Positive Observations

- **Clean separation of concerns:** backend layers (db, service, models, routes) are well-factored and easy to follow.
- **Consistent error contract:** the `_error_payload` helper ensures uniform error shape across endpoints.
- **Good test coverage:** 42 backend + 25 frontend unit + 6 e2e tests covering the key paths.
- **App factory pattern:** `create_app()` accepting optional parameters makes testing straightforward.
- **Frontend API client:** `api.ts` properly encodes usernames and parses error responses.
- **AI response parsing:** code fence stripping in `parse_ai_response` handles a common LLM output format issue.
- **Board validation:** Pydantic model with cross-field validator catches broken card references and orphan cards before they reach the database.

---

## Remediation Status

| ID | Severity | Status |
|----|----------|--------|
| H1 | High | Verified not in git -- no action needed |
| H2 | High | Documented in AGENTS.md |
| H3 | High | Fixed -- narrowed exception types |
| M1 | Medium | Fixed -- Pydantic ChatRequest model |
| M2 | Medium | Fixed -- 400ms debounce on rename |
| M3 | Medium | Fixed -- persist outside setState |
| M4 | Medium | Fixed -- removed dead initialData |
| M5 | Medium | Fixed -- shared conftest.py |
| M6 | Medium | Fixed -- MAX_HISTORY_MESSAGES = 20 |
| L1 | Low | Fixed -- relative positioning |
| L2 | Low | Fixed -- unique message IDs |
| L3 | Low | Fixed -- isolated test DB |
| L4 | Low | Verified OK |
| L5 | Low | Fixed -- updated .dockerignore |
| L6 | Low | Fixed -- renamed to public |
| L7 | Low | Fixed -- orphan card validation |

All tests pass after remediation:
- Backend: 41 passed, 1 skipped (AI smoke test requires live API key)
- Frontend unit: 25 passed
- E2E (Playwright): 6 passed
