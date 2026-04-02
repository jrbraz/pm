# Codex Code Review

Reviewed on 2026-04-02.

Scope:
- Read the backend, frontend, Docker, and script entrypoints.
- Ran `backend: uv run pytest` -> `226 passed, 1 skipped`.
- Ran `frontend: npm run test:unit` -> `103 passed`.

## Findings

### High

1. Shared-board AI chat is effectively broken for invited users.
Files:
- `backend/app/routes/chat.py:73`
- `backend/app/routes/chat.py:94`
- `backend/app/routes/chat.py:103`
- `backend/app/board_service.py:121`
- `backend/app/board_service.py:168`

Why this matters:
- The board read/save endpoints already support owner-or-member access, but the board chat endpoint still uses the owner-only helpers.
- In the current frontend, the chat sidebar sends the logged-in user's username in the path. If Bob opens Alice's shared board, the request becomes `/api/users/bob/boards/{alice_board_id}/chat`, and `get_board_for_user()` returns `None` because that board is not owned by Bob.
- Result: shared boards can be opened and edited by members, but the AI feature quietly stops working on the same board.

Suggestion:
- Make board chat use the same access model as board read/write: `require_board_access(...)`, `get_named_board_with_access(...)`, and `save_named_board_with_access(...)`.
- Decide explicitly whether viewers can use chat in read-only mode or whether chat should require `member`.

2. The board settings panel misidentifies the owner and shows owner-only controls to non-owners.
Files:
- `frontend/src/components/BoardSettingsPanel.tsx:15`
- `frontend/src/components/BoardSettingsPanel.tsx:48`
- `frontend/src/components/BoardSettingsPanel.tsx:58`
- `frontend/src/components/BoardSettingsPanel.tsx:132`
- `frontend/src/components/BoardSettingsPanel.tsx:163`
- `frontend/src/components/BoardSettingsPanel.tsx:190`

Why this matters:
- The owner row is rendered from the `username` prop, which is the current logged-in user, not the actual board owner.
- `owner_user_id` is fetched, and `isOwner` is computed, but that value is never used to hide or disable invite/remove/role-edit controls.
- On a shared board, a member can see themselves labeled as "Owner" and is invited to use controls that the backend will reject.

Suggestion:
- Return `owner_username` and `current_user_role` from the members endpoint, or include them in the named-board payload.
- Render the real owner identity.
- Hide or disable invite/remove/role-management controls unless the current user is the owner.

### Medium

3. Shared boards appear on the dashboard but disappear from the left sidebar.
Files:
- `backend/app/routes/board.py:80`
- `backend/app/routes/board.py:91`
- `backend/app/db/boards.py:11`
- `backend/app/db/boards.py:30`
- `frontend/src/components/BoardSelector.tsx:29`
- `frontend/src/components/DashboardPage.tsx:103`

Why this matters:
- The dashboard is built from `get_boards_accessible_to_user()`, so it includes shared boards.
- The sidebar board selector is built from `list_boards_for_user()`, which returns owned boards only.
- That creates an inconsistent navigation model: a shared board can be opened from the dashboard, but it cannot be reselected from the main sidebar and does not appear in the persistent board list.

Suggestion:
- Decide whether the sidebar is meant to show only owned boards or all accessible boards.
- If the intended UX is "all boards I can work with", change the `/boards` list endpoint and `BoardSummary` shape to include shared boards and their `owner_username` / `access_role`.

4. Viewer permissions are enforced in the backend, but the board UI still behaves as fully editable.
Files:
- `backend/app/board_models.py:67`
- `frontend/src/lib/api.ts:20`
- `backend/app/routes/board.py:155`
- `backend/app/routes/board.py:178`
- `frontend/src/components/KanbanBoard.tsx:58`
- `frontend/src/components/KanbanBoard.tsx:89`
- `frontend/src/components/CardDetailPanel.tsx:128`
- `frontend/src/components/CardDetailPanel.tsx:297`

Why this matters:
- `get_named_board_with_access()` computes `access_role`, but `NamedBoardResponse` and `NamedBoardPayload` throw that information away.
- The frontend therefore cannot distinguish owner/member/viewer when rendering the board.
- A viewer can drag cards, edit card details, open settings, and try to save, only to hit a generic error when the backend rejects the write with `403`.

Suggestion:
- Include the effective role in the named-board response.
- Render a read-only board mode for viewers: disable drag-and-drop, hide destructive/edit controls, and show a clear "read-only" state instead of a generic save failure.

5. Comments can be created for card IDs that do not exist in the board.
Files:
- `backend/app/routes/comments.py:48`
- `backend/app/routes/comments.py:66`
- `backend/app/db/comments.py:7`

Why this matters:
- The comments API validates board access, but it never validates that `card_id` exists in the current board JSON.
- That allows orphan comments to be created for stale or fabricated card IDs.
- Once that happens, the UI has no natural place to surface or clean up those comments.

Suggestion:
- Validate the target `card_id` against the board before creating a comment.
- Consider whether `list_comments` for a missing card should return `404` rather than an empty list.

6. The user profile and password-change routes are missing the same auth checks used elsewhere.
Files:
- `backend/app/routes/users.py:24`
- `backend/app/routes/users.py:39`

Why this matters:
- `GET /api/users/{username}/profile` has no authentication at all.
- `POST /api/users/{username}/change-password` also has no session requirement and no username-to-token match.
- Even in a local MVP, this is inconsistent with the rest of the API surface, and it makes these routes easier to misuse than the board routes.

Suggestion:
- Add `Depends(get_current_user)` to both endpoints.
- Reject requests unless the token username matches the path username.

7. The Docker healthcheck is very likely to report `unhealthy` even when the app is fine.
Files:
- `docker-compose.yml:13`
- `Dockerfile:11`
- `Dockerfile:16`

Why this matters:
- The compose healthcheck runs `curl -f http://localhost:8000/api/health`.
- The runtime image is `python:3.12-slim`, and the Dockerfile never installs `curl`.
- Inference: the container can start correctly but still fail the healthcheck command because the binary is missing.

Suggestion:
- Either install `curl`, or switch the healthcheck to a tool already present in the image.
- A small Python one-liner is usually the simplest option in this image family.

### Low

8. The Docker build does not use the checked-in `uv.lock` when installing backend dependencies.
Files:
- `Dockerfile:20`
- `Dockerfile:21`
- `Dockerfile:23`

Why this matters:
- `uv sync --project /app/backend --no-dev` runs before `backend/uv.lock` is copied into the image.
- That means the image build resolves dependencies from `pyproject.toml` instead of from the committed lock file.
- The result is weaker reproducibility between local runs and container builds.

Suggestion:
- Copy `backend/uv.lock` before running `uv sync`.
- Keep the dependency-install layer keyed on `pyproject.toml` + `uv.lock` only.

9. Chat history is not reset when the user switches boards.
Files:
- `frontend/src/components/AuthGate.tsx:295`
- `frontend/src/components/ChatSidebar.tsx:18`
- `frontend/src/components/ChatSidebar.tsx:20`
- `frontend/src/components/ChatSidebar.tsx:30`

Why this matters:
- `ChatSidebar` keeps `messages` in local state and never clears them when `boardId` changes.
- The user can switch from one board to another and still see the previous conversation, even though the next AI request is now scoped to a different board.
- That is confusing in the UI and mixes context across unrelated boards.

Suggestion:
- Reset `messages`, `input`, and `error` on `boardId` change.
- If cross-board conversation is a deliberate feature, the UI needs to label that clearly and persist history by board instead of sharing a single in-memory thread.

## Testing Gaps

- There is backend coverage for shared-board access, but no frontend test that walks the shared-board UX end-to-end through sidebar, board view, settings panel, and chat.
- There is no container-level test that asserts the Docker healthcheck actually becomes healthy.
- There is no API test that proves comments are rejected for missing card IDs.

## Test Hygiene Notes

- The frontend unit suite passes, but several tests emit React `act(...)` warnings, and `AuthGate.test.tsx` emits a jsdom navigation warning.
- Those warnings do not break CI today, but they reduce trust in the test signal and are worth cleaning up.
