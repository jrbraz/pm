# Local Run (Part 4)

## Docker Compose

Start:

```bash
docker compose up --build -d
```

Stop:

```bash
docker compose down
```

App URL:

- `http://127.0.0.1:8000/`
- This now serves the statically built Next.js Kanban frontend via FastAPI.
- API example: `http://127.0.0.1:8000/api/hello`

Login credentials for MVP:

- Username: `user`
- Password: `password`

Database:

- SQLite file is auto-created at `backend/data/pm.db` by default.
- Override path with `DB_PATH` environment variable.

Backend API:

- `GET /api/users/user/board`
- `PUT /api/users/user/board`
- Full endpoint details: `docs/BACKEND_API.md`

Frontend persistence behavior:

- Kanban data at `/` is fetched from backend API after login.
- Card and column changes are persisted to SQLite through the backend.

## Script Shortcuts

From project root:

- Windows: `./scripts/start-server-windows.ps1` and `./scripts/stop-server-windows.ps1`
- Linux: `./scripts/start-server-linux.sh` and `./scripts/stop-server-linux.sh`
- macOS: `./scripts/start-server-mac.sh` and `./scripts/stop-server-mac.sh`
