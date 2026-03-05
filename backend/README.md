# Backend

FastAPI backend for the Project Management MVP.

Run locally with `uv`:

```bash
uv run uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Database:

- SQLite schema is created automatically on app startup.
- Default DB path: `backend/data/pm.db` (override with `DB_PATH`).

Board API:

- `GET /api/users/{username}/board`
- `PUT /api/users/{username}/board`
