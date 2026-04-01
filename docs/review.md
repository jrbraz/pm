# Code Review

Date: 2026-04-01

## Executive Summary

The codebase is well-structured for an MVP with clean separation of concerns and a solid test foundation. The main concerns are around error handling robustness, defensive programming in external API integrations, and a handful of correctness issues. No showstopper bugs, but several gaps would cause problems in production.

---

## 1. Bugs & Correctness

### 1.1 No Bounds Checking on OpenRouter Response — HIGH
**File:** `backend/app/ai_client.py:40`

```python
response.json()["choices"][0]["message"]["content"]
```

If OpenRouter returns an unexpected structure (empty `choices`, missing `message`, etc.), this raises an unhandled `KeyError` or `IndexError` that propagates as a 500. Wrap in a try/except with a meaningful error message.

### 1.2 Unhandled JSONDecodeError on Corrupted Board — HIGH
**File:** `backend/app/board_service.py:69`

`json.loads()` on `board_json` from the database can raise `json.JSONDecodeError` if the stored value is corrupted. This exception propagates to the route without handling. Should catch and either return the default board or raise a clearer error.

### 1.3 Fragile Markdown Fence Stripping — MEDIUM
**File:** `backend/app/ai_chat.py:76-77`

The `parse_ai_response()` function strips opening ` ``` ` fences but only removes the closing fence if it exists on its own line. A response with an opening fence but no closing fence passes the check and then fails at `json.loads()` with a confusing error. Use a more defensive regex-based approach or validate output before parsing.

### 1.4 Silent Card ID Mismatch — MEDIUM
**File:** `frontend/src/components/KanbanBoard.tsx:253-255`

When rendering a column, card IDs that exist in `column.cardIds` but not in `board.cards` are silently filtered out. The card disappears from the UI with no indication. At minimum, add a `console.warn` so the issue is visible in development.

### 1.5 No Runtime Validation of API Responses — MEDIUM
**File:** `frontend/src/lib/api.ts:41,61`

`fetchBoard()` and `saveBoard()` cast the response directly to `BoardPayload` without runtime validation. If the backend schema changes, TypeScript won't catch the mismatch at runtime and components will fail with cryptic errors.

---

## 2. Security

### 2.1 Client-Side-Only Authentication — HIGH
**File:** `frontend/src/components/AuthGate.tsx:8-10,18-20`

Credentials are hardcoded in client-side JavaScript (`VALID_USERNAME = "user"`, `VALID_PASSWORD = "password"`) and auth state is stored in `localStorage`. Both the credentials and the auth flag are trivially discoverable and manipulable. This is documented as an MVP tradeoff but provides no real security.

### 2.2 No HTTPS Enforcement — MEDIUM
**File:** `Dockerfile`, `docker-compose.yml`

The OpenRouter API key is transmitted in `Authorization: Bearer` headers, but neither the Dockerfile nor docker-compose configure TLS. In production, HTTPS must be enforced to prevent key interception.

### 2.3 Inconsistent Error Handling Exposes Implementation Details — LOW
**File:** `backend/app/routes/chat.py:48-52`

The broad exception catch converts exceptions to strings with `str(exc)` and returns them in the response body. Depending on the exception type, this can expose internal paths, schema details, or API configuration to the client. Log errors server-side and return a sanitized message.

---

## 3. Missing Error Handling

### 3.1 No Content-Type Validation Before JSON Parsing — MEDIUM
**File:** `frontend/src/lib/api.ts:36,49,70`

`fetchBoard()`, `saveBoard()`, and `sendChat()` call `response.json()` unconditionally. If the server returns an HTML error page (e.g., a gateway error), this fails with a confusing JSON parse error rather than a clear HTTP error message. Check `response.ok` and `content-type` before parsing.

### 3.2 Empty/Malformed Validation Inconsistency — LOW
**File:** `backend/app/routes/chat.py:31-36`

Empty message validation (line 32-36) returns a hand-crafted `JSONResponse(status_code=400)`, while missing fields return FastAPI's default 422. This creates two different error shapes for similar validation failures. Prefer Pydantic field validators for consistency.

### 3.3 Server Errors Not Logged — LOW
**File:** `backend/app/routes/chat.py:48-52`

Exceptions are serialized to the response but never logged server-side. In production there is no trace of what went wrong unless the client reports the error message.

---

## 4. Code Quality

### 4.1 Missing Return Type on Route Handlers — LOW
**File:** `backend/app/routes/chat.py:31`, `backend/app/routes/ai_test.py:12`

Both route handlers return `dict` instead of a typed response model. Using `dict` loses FastAPI's automatic response schema generation and makes it harder to catch contract changes.

### 4.2 Module-Level Mutable Counter in Component — LOW
**File:** `frontend/src/components/ChatSidebar.tsx:8-9`

```typescript
let nextMsgId = 0;
const msgId = () => `msg-${++nextMsgId}`;
```

This is module-level shared mutable state. It works, but is not idiomatic React — it won't reset on unmount/remount and is not obvious to future readers. Use `useRef` or React 18's `useId()` hook.

### 4.3 Full Board State in Every AI Prompt — MEDIUM
**File:** `backend/app/ai_chat.py:52-64`

The entire board JSON is injected into every chat message. For large boards this increases token count, latency, and OpenRouter cost on every request. Consider sending a condensed summary or only relevant columns when the board grows large.

### 4.4 KanbanBoard Component Doing Too Much — LOW
**File:** `frontend/src/components/KanbanBoard.tsx:24-127`

The component handles board loading/saving, drag-and-drop, card CRUD, and error state in ~130 lines. Splitting into smaller focused components would improve testability and readability.

---

## 5. Accessibility

### 5.1 Chat Messages Have No Live Region — MEDIUM
**File:** `frontend/src/components/ChatSidebar.tsx:74-95`

The messages container has no `role="log"` or `aria-live="polite"` attribute. Screen reader users are not notified when new messages arrive.

### 5.2 No DnD Accessibility Announcements — LOW
**File:** `frontend/src/components/KanbanBoard.tsx:242-269`

Drag-and-drop operations have no ARIA announcements for screen readers. The `@dnd-kit` library supports accessibility announcements via the `announcements` prop on `DndContext` — this is not configured.

---

## 6. Testing Gaps

### 6.1 No Test for OpenRouter Response Edge Cases
**File:** `backend/tests/test_ai_client.py`

Tests mock the happy path but do not cover:
- Missing `choices` array in response
- `choices` list is empty
- Timeout behavior
- Malformed JSON response body

### 6.2 No Integration Test for Chat + Board Update Flow
No test covers the full path: user sends message → AI returns board update → board is persisted → subsequent GET reflects the change. All AI tests mock the client at the boundary.

### 6.3 Frontend E2E Tests Miss Failure Scenarios
**File:** `frontend/tests/kanban.spec.ts`

No tests for:
- Network error during board load
- Chat request failure mid-conversation
- Column rename with very long names or special characters

### 6.4 Missing Unit Tests for moveCard Edge Cases
**File:** `frontend/src/lib/kanban.ts`

`moveCard()` handles three distinct scenarios (same-column reorder, same-column drop-on-column, cross-column move) but has no unit tests covering the edge cases: dragging to the same position, or a card ID that doesn't exist.

---

## 7. Documentation Gaps

### 7.1 moveCard Logic Undocumented
**File:** `frontend/src/lib/kanban.ts:28-106`

The function is complex with multiple branches but has no comments explaining the three drag scenarios or what `isOverColumn` means. JSDoc would help future maintainers.

### 7.2 AI Prompt Completeness Requirement Not Explained
**File:** `backend/app/ai_chat.py:8-35`

The system prompt requires the AI to return the *complete* board state, not just changes. This is critical for correctness but the reason (atomicity, no partial merge logic) is not explained in a comment.

---

## 8. Infrastructure

### 8.1 No Docker HEALTHCHECK
**File:** `Dockerfile`

No `HEALTHCHECK` directive means container orchestrators cannot detect if the app has started or become unresponsive. Add:

```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8000/api/health || exit 1
```

### 8.2 Loose Dependency Versions in Backend
**File:** `backend/pyproject.toml`

Dependencies like `fastapi>=0.116.1` accept any future major/minor version. Pin to exact versions before production to prevent unexpected breaking changes on redeploy.

---

## Summary

| Priority | Area | Issue |
|---|---|---|
| High | Backend | No bounds checking on OpenRouter response structure (`ai_client.py:40`) |
| High | Backend | Unhandled `JSONDecodeError` on corrupted board JSON (`board_service.py:69`) |
| High | Security | Client-side-only authentication (hardcoded credentials) |
| Medium | Backend | Fragile markdown fence stripping in `parse_ai_response()` |
| Medium | Frontend | Silent card ID mismatch — no warning logged |
| Medium | Frontend | No content-type validation before `response.json()` |
| Medium | Security | No HTTPS enforcement in Docker config |
| Medium | Performance | Full board state in every AI prompt |
| Medium | A11y | Chat messages missing `role="log"` / `aria-live` |
| Low | Backend | Inconsistent error handling between custom validation and Pydantic |
| Low | Backend | Server-side errors not logged |
| Low | Frontend | Module-level mutable ID counter in ChatSidebar |
| Low | Testing | Missing edge case tests for AI client, moveCard, and E2E failure paths |
| Low | Infra | No Docker HEALTHCHECK |

## Positive Findings

- Clean three-layer architecture (routes / service / db) in the backend
- Correct SQL parameterization throughout — no injection risk
- Pydantic models with cross-field validators provide strong board data validation
- App factory pattern (`create_app()`) makes the test setup clean and flexible
- Good use of `useCallback`, `useRef`, and dependency arrays in React components
- Full TypeScript coverage in the frontend
- `@dnd-kit` integration is correct and handles the complex drag scenarios well
- Consistent error response structure via `error_payload()` helper
