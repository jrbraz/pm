# Backend API (Part 6)

## Health

- `GET /api/health`
- Response:
  - `200`: `{"status":"ok"}`

## Example

- `GET /api/hello`
- Response:
  - `200`: `{"message":"Hello from FastAPI"}`

## Board by User

### Get board

- `GET /api/users/{username}/board`
- Behavior:
  - Creates user if missing.
  - Creates and persists default empty board if missing.
- Response:
  - `200`:
    - `{"username":"user","board":{...}}`

### Replace board

- `PUT /api/users/{username}/board`
- Body:
  - Full board JSON:
    - `columns`: array of `{ id, title, cardIds }`
    - `cards`: map of card id to `{ id, title, details }`
- Response:
  - `200`: saved board payload

### Validation errors

- Response:
  - `422`:
    - `{"error":{"code":"VALIDATION_ERROR","message":"Request validation failed."}}`

## Notes

- Board data is stored as JSON text in SQLite.
- Database path defaults to `backend/data/pm.db` and can be overridden with `DB_PATH`.
