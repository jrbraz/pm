# Database Design (Part 5)

This MVP uses SQLite with one board per user, stored as JSON.

## Goals

- Keep MVP persistence simple.
- Support multiple users in schema for future expansion.
- Keep one-board-per-user behavior for MVP.

## File Location

- Default DB path: `backend/data/pm.db`
- Override via env var: `DB_PATH`

## Schema

```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE boards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    board_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

## Notes

- `boards.user_id` is `UNIQUE`, enforcing one board per user.
- `board_json` stores complete Kanban state as JSON text in MVP.
- Timestamp fields support basic auditing and future sync logic.
- Schema is created automatically at app bootstrap if DB file does not exist.

## MVP User Mapping

- Login remains hardcoded (`user` / `password`) in frontend for now.
- Backend DB layer already supports future multi-user expansion by username.

## Part 5 Sign-Off Request

Please confirm this schema and storage approach before Part 6 API implementation.
