# Project Rules

Complete reference of all business rules, constraints, and behaviors for the Kanban Board project.

---

## 1. Authentication & Accounts

### Registration
- Username: minimum 2 characters, must be unique (case-sensitive).
- Password: minimum 8 characters.
- Duplicate usernames are rejected.

### Login
- Requires a registered account with a password hash.
- Legacy users (created without a password) cannot log in and must re-register.
- Returns a session token valid for 30 days.

### Sessions
- Tokens: URL-safe, 32-byte random strings.
- Expired sessions are automatically cleaned up on server startup.
- All API endpoints (except health check) require a valid `Authorization: Bearer <token>` header.
- A 401 response from any API call clears the client-side token and forces re-login.

### Password Changes
- Current password must be verified before accepting a new one.
- New password minimum: 8 characters.
- Accounts without a stored password hash cannot change passwords.

### User Search
- Requires authentication.
- Minimum query length: 1 character.
- Returns up to 10 matching users (prefix search).

---

## 2. Boards

### Creation
- The first board for a user is automatically populated with the **Default Board** template (5 columns, 8 sample cards).
- All subsequent boards use the **Empty Board** template (3 empty columns: Backlog, In Progress, Done).
- Board name is required and cannot be empty after trimming whitespace.

### Unique Names
- Board names must be unique per user (case-insensitive).
- Creating, renaming, or duplicating a board to an existing name returns **409 Conflict**.
- Different users can have boards with the same name.
- Renaming a board to its own current name is allowed.

### Access Control
| Operation        | Required Role |
|------------------|---------------|
| View board       | viewer+       |
| Edit board/cards | member+       |
| Rename board     | owner         |
| Delete board     | owner         |
| Duplicate board  | owner         |
| Manage members   | owner         |

### Board List Pagination
- Default limit: 50 boards per page.
- Maximum limit: 100 boards per page.
- Offset must be >= 0.

### Duplication
- Creates an exact copy of the board JSON under a new name.
- Duplicated boards are never marked as default.
- Activity is logged with `duplicated_from` reference.

### Data Validation
- Every card ID referenced in a column's `cardIds` must exist in the `cards` dictionary.
- Every card in the `cards` dictionary must be referenced by at least one column.
- Orphaned or missing card references are rejected.

### Optimistic Locking
- Board updates optionally accept an `expected_updated_at` timestamp.
- If the board was modified since that timestamp, a `BoardConflictError` is raised.
- The client must reload and retry.

---

## 3. Cards

### Sequential IDs
- Card IDs follow the format `CARD-{number}` (e.g., CARD-1, CARD-9, CARD-42).
- The sequence counter (`card_seq`) is stored per user in the database, not per board.
- IDs are unique across all boards for a user.
- The counter is reserved atomically via `POST /api/users/{username}/next-card-id`.
- When the default board is seeded (8 cards), the counter is set to 8.

### Card Fields
| Field          | Type                                        | Required | Default |
|----------------|---------------------------------------------|----------|---------|
| `id`           | string (min 1 char)                         | yes      | --      |
| `title`        | string (min 1 char)                         | yes      | --      |
| `details`      | string                                      | yes      | `""`    |
| `priority`     | `"low"` / `"medium"` / `"high"` / `"critical"` / null | no | null |
| `labels`       | string[]                                    | no       | `[]`    |
| `due_date`     | `"YYYY-MM-DD"` / null                       | no       | null    |
| `checklist`    | ChecklistItem[]                             | no       | `[]`    |
| `assignee_ids` | string[]                                    | no       | `[]`    |

### Checklist Items
| Field  | Type    | Required | Default |
|--------|---------|----------|---------|
| `id`   | string  | yes      | --      |
| `text` | string  | yes      | --      |
| `done` | boolean | no       | false   |

### Card Display
- Card ID is shown on each card in the UI.
- Overdue cards: `due_date < today` (compared as ISO date strings).

---

## 4. Board Members

### Role Hierarchy
| Role   | Level | Permissions                                |
|--------|-------|--------------------------------------------|
| viewer | 0     | Read board, list members, view comments    |
| member | 1     | All viewer permissions + edit board, comment |
| owner  | 2     | All member permissions + manage members, rename, delete |

### Invitation Rules
- Only the board owner can invite members.
- Members can be invited as `member` or `viewer`.
- The board owner cannot be added as a member (409 Conflict).
- A user cannot be added twice (409 Conflict).

### Removal Rules
- The board owner can remove any member.
- Members can remove themselves (leave the board).
- Members cannot remove other members.

---

## 5. Comments

### Permissions
- **Post comment**: requires `member` role or higher.
- **Read comments**: requires `viewer` role or higher.
- **Edit comment**: only the comment author.
- **Delete comment**: the comment author or the board owner.

### Validation
- Comment body is required and cannot be empty after trimming.

---

## 6. Activity Log

### Tracked Actions
| Entity    | Actions                                |
|-----------|----------------------------------------|
| board     | created, updated, renamed              |
| member    | invited, role_changed, removed         |
| comment   | commented                              |

### Retrieval
- Default limit: 50 entries per page.
- Maximum limit: 200 entries per page.
- Offset clamped to >= 0.
- Supports filtering by `card_id`.
- Ordered newest first.

### Dashboard
- Requires the authenticated user to match the URL username.
- Shows all accessible boards (owned + member of).
- Displays recent activity (last 20 entries across all boards).
- Aggregates: total boards, total cards, total overdue.
- Boards with corrupted JSON are skipped with a warning log.

---

## 7. AI Chat

### Configuration
- Model: `openai/gpt-oss-120b` via OpenRouter.
- Request timeout: 60 seconds.
- API key from `OPENROUTER_API_KEY` environment variable.

### Conversation Rules
- Maximum history: 20 messages (~10 user/assistant pairs).
- History is trimmed from the start (keeps the most recent messages).
- The AI receives the full current board state as context.

### Response Format
The AI must respond with valid JSON:
```json
{
  "reply": "Conversational response to the user.",
  "board_update": null
}
```
If modifying the board, `board_update` contains the complete new board state.

### Card IDs from AI
- AI generates card IDs in the format `card-<random8chars>`.
- These are distinct from the user-facing sequential IDs.

### Error Handling
- AI errors, network failures, and invalid JSON return HTTP 502.
- Chat endpoints require authentication and username validation.

---

## 8. Frontend Behavior

### Board Saves
- Saves are debounced by 500ms to batch rapid changes.
- Save status is shown in the header ("Saving..." / "Saved").
- Failed saves display an error message.

### Filtering
- Three independent filters: search text, priority, and label.
- Filters are AND-combined (card must match all active filters).
- Filters are applied client-side (not sent to the API).
- Clear button resets all filters.

### External Updates
- When the AI chat modifies the board, a notification banner appears.
- The user can choose to Reload (fetch latest) or Dismiss.
- The board is not silently overwritten.

### Board Selector
- Error messages (e.g., duplicate name) appear in a red banner.
- Errors auto-clear after 4 seconds.
- The last remaining board cannot be deleted.
- Inline rename: submits on Enter, cancels on Escape.

### Drag and Drop
- Uses `@dnd-kit` with a 6px activation distance.
- Cards can be moved within a column or between columns.
- Drop preview shows a lightweight card preview.

### Error Boundary
- A top-level error boundary catches rendering errors.
- Shows a "Something went wrong" page with a Reload button.

---

## 9. API Response Conventions

### Error Format
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message."
  }
}
```

### Status Codes
| Code | Meaning                       |
|------|-------------------------------|
| 200  | Success                       |
| 201  | Created                       |
| 204  | Deleted (no content)          |
| 400  | Validation error              |
| 401  | Authentication required       |
| 403  | Forbidden (wrong user / role) |
| 404  | Not found                     |
| 409  | Conflict (duplicate)          |
| 422  | Request validation failed     |
| 502  | AI / external service error   |

---

## 10. Database

### Schema Version: 3

### Tables
| Table           | Purpose                        |
|-----------------|--------------------------------|
| users           | Accounts + card sequence       |
| boards          | Board metadata + JSON blob     |
| sessions        | Auth tokens                    |
| board_members   | Board sharing                  |
| card_comments   | Card-level comments            |
| activity_log    | Audit trail                    |
| schema_version  | Migration tracking             |

### Key Constraints
- Foreign keys enforced with `ON DELETE CASCADE`.
- `board_members` has a unique constraint on `(board_id, user_id)`.
- `sessions.token` is unique.
- `users.username` is unique.

### Migrations
- Run on every startup, but only applied if `schema_version < CURRENT_SCHEMA_VERSION`.
- Idempotent: safe to run multiple times.

---

## 11. Environment Variables

| Variable             | Required | Description                          |
|----------------------|----------|--------------------------------------|
| `OPENROUTER_API_KEY` | Yes      | API key for AI chat features         |
| `DB_PATH`            | No       | Override default SQLite database path |
| `FRONTEND_DIST_DIR`  | No       | Override frontend static files path  |
