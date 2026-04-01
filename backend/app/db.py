import sqlite3
from pathlib import Path

DEFAULT_DB_PATH = (Path(__file__).resolve().parents[1] / "data" / "pm.db").resolve()

NEW_SCHEMA_SQL = """
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS boards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL DEFAULT 'My Board',
    board_json TEXT NOT NULL,
    is_default INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
"""


def _migrate_database(conn: sqlite3.Connection) -> None:
    """Apply schema migrations for existing databases."""
    # Check if boards table has 'name' column (new schema)
    board_cols = [row[1] for row in conn.execute("PRAGMA table_info(boards)").fetchall()]
    if "name" not in board_cols:
        # Migrate boards: old schema had UNIQUE on user_id. Recreate table.
        conn.executescript("""
            CREATE TABLE boards_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                name TEXT NOT NULL DEFAULT 'My Board',
                board_json TEXT NOT NULL,
                is_default INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            INSERT INTO boards_new (id, user_id, name, board_json, is_default, created_at, updated_at)
                SELECT id, user_id, 'My Board', board_json, 1, created_at, updated_at FROM boards;
            DROP TABLE boards;
            ALTER TABLE boards_new RENAME TO boards;
        """)

    # Check if users table has 'password_hash' column
    user_cols = [row[1] for row in conn.execute("PRAGMA table_info(users)").fetchall()]
    if "password_hash" not in user_cols:
        conn.execute("ALTER TABLE users ADD COLUMN password_hash TEXT")

    # Create sessions table if missing
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            token TEXT NOT NULL UNIQUE,
            expires_at TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
    """)

    conn.commit()


def initialize_database(db_path: Path) -> None:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(db_path) as connection:
        connection.executescript(NEW_SCHEMA_SQL)
        _migrate_database(connection)
        connection.commit()


# ---------------------------------------------------------------------------
# User helpers
# ---------------------------------------------------------------------------

def get_or_create_user_id(db_path: Path, username: str) -> int:
    with sqlite3.connect(db_path) as connection:
        cursor = connection.execute(
            "INSERT OR IGNORE INTO users (username) VALUES (?)",
            (username,),
        )
        if cursor.rowcount:
            connection.commit()

        row = connection.execute(
            "SELECT id FROM users WHERE username = ?",
            (username,),
        ).fetchone()
        if row is None:
            raise RuntimeError("Failed to get or create user.")
        return int(row[0])


def create_user(db_path: Path, username: str, password_hash: str) -> int:
    """Create a new user with a password hash. Raises ValueError if username taken."""
    with sqlite3.connect(db_path) as connection:
        try:
            cursor = connection.execute(
                "INSERT INTO users (username, password_hash) VALUES (?, ?)",
                (username, password_hash),
            )
            connection.commit()
            return int(cursor.lastrowid)
        except sqlite3.IntegrityError:
            raise ValueError(f"Username '{username}' is already taken.")


def get_user_by_username(db_path: Path, username: str) -> dict | None:
    """Return user dict (id, username, password_hash) or None."""
    with sqlite3.connect(db_path) as connection:
        row = connection.execute(
            "SELECT id, username, password_hash FROM users WHERE username = ?",
            (username,),
        ).fetchone()
        if row is None:
            return None
        return {"id": row[0], "username": row[1], "password_hash": row[2]}


# ---------------------------------------------------------------------------
# Session helpers
# ---------------------------------------------------------------------------

def create_session(db_path: Path, user_id: int, token: str, expires_at: str) -> None:
    with sqlite3.connect(db_path) as connection:
        connection.execute(
            "INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)",
            (user_id, token, expires_at),
        )
        connection.commit()


def get_session(db_path: Path, token: str) -> dict | None:
    """Return session dict (user_id, username, expires_at) or None."""
    with sqlite3.connect(db_path) as connection:
        row = connection.execute(
            """
            SELECT s.user_id, u.username, s.expires_at
            FROM sessions s
            JOIN users u ON u.id = s.user_id
            WHERE s.token = ?
            """,
            (token,),
        ).fetchone()
        if row is None:
            return None
        return {"user_id": row[0], "username": row[1], "expires_at": row[2]}


def delete_session(db_path: Path, token: str) -> None:
    with sqlite3.connect(db_path) as connection:
        connection.execute("DELETE FROM sessions WHERE token = ?", (token,))
        connection.commit()


# ---------------------------------------------------------------------------
# Board helpers (multi-board)
# ---------------------------------------------------------------------------

def get_boards_for_user(db_path: Path, user_id: int) -> list[dict]:
    """Return list of board summary dicts for a user."""
    with sqlite3.connect(db_path) as connection:
        rows = connection.execute(
            "SELECT id, name, is_default, created_at, updated_at FROM boards WHERE user_id = ? ORDER BY created_at",
            (user_id,),
        ).fetchall()
        return [
            {
                "id": row[0],
                "name": row[1],
                "is_default": bool(row[2]),
                "created_at": row[3],
                "updated_at": row[4],
            }
            for row in rows
        ]


def get_board_by_id(db_path: Path, board_id: int, user_id: int) -> dict | None:
    """Return board dict (id, name, board_json, is_default) or None."""
    with sqlite3.connect(db_path) as connection:
        row = connection.execute(
            "SELECT id, name, board_json, is_default, created_at, updated_at FROM boards WHERE id = ? AND user_id = ?",
            (board_id, user_id),
        ).fetchone()
        if row is None:
            return None
        return {
            "id": row[0],
            "name": row[1],
            "board_json": row[2],
            "is_default": bool(row[3]),
            "created_at": row[4],
            "updated_at": row[5],
        }


def get_default_board(db_path: Path, user_id: int) -> dict | None:
    """Return the first/default board for a user."""
    with sqlite3.connect(db_path) as connection:
        row = connection.execute(
            "SELECT id, name, board_json, is_default, created_at, updated_at FROM boards WHERE user_id = ? AND is_default = 1 LIMIT 1",
            (user_id,),
        ).fetchone()
        if row is None:
            # Fall back to first board
            row = connection.execute(
                "SELECT id, name, board_json, is_default, created_at, updated_at FROM boards WHERE user_id = ? ORDER BY created_at LIMIT 1",
                (user_id,),
            ).fetchone()
        if row is None:
            return None
        return {
            "id": row[0],
            "name": row[1],
            "board_json": row[2],
            "is_default": bool(row[3]),
            "created_at": row[4],
            "updated_at": row[5],
        }


def create_board(db_path: Path, user_id: int, name: str, board_json: str, is_default: bool = False) -> int:
    """Create a new board and return its id."""
    with sqlite3.connect(db_path) as connection:
        cursor = connection.execute(
            "INSERT INTO boards (user_id, name, board_json, is_default) VALUES (?, ?, ?, ?)",
            (user_id, name, board_json, int(is_default)),
        )
        connection.commit()
        return int(cursor.lastrowid)


def update_board_json(db_path: Path, board_id: int, user_id: int, board_json: str) -> None:
    with sqlite3.connect(db_path) as connection:
        connection.execute(
            "UPDATE boards SET board_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?",
            (board_json, board_id, user_id),
        )
        connection.commit()


def rename_board(db_path: Path, board_id: int, user_id: int, name: str) -> None:
    with sqlite3.connect(db_path) as connection:
        connection.execute(
            "UPDATE boards SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?",
            (name, board_id, user_id),
        )
        connection.commit()


def delete_board(db_path: Path, board_id: int, user_id: int) -> bool:
    """Delete a board. Returns True if deleted."""
    with sqlite3.connect(db_path) as connection:
        cursor = connection.execute(
            "DELETE FROM boards WHERE id = ? AND user_id = ?",
            (board_id, user_id),
        )
        connection.commit()
        return cursor.rowcount > 0


# ---------------------------------------------------------------------------
# Legacy single-board helpers (kept for backward compat)
# ---------------------------------------------------------------------------

def get_board_json(db_path: Path, user_id: int) -> str | None:
    board = get_default_board(db_path, user_id)
    return board["board_json"] if board else None


def upsert_board_json(db_path: Path, user_id: int, board_json: str) -> None:
    with sqlite3.connect(db_path) as connection:
        row = connection.execute(
            "SELECT id FROM boards WHERE user_id = ? AND is_default = 1 LIMIT 1",
            (user_id,),
        ).fetchone()
        if row:
            connection.execute(
                "UPDATE boards SET board_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                (board_json, row[0]),
            )
        else:
            connection.execute(
                "INSERT INTO boards (user_id, name, board_json, is_default) VALUES (?, 'My Board', ?, 1)",
                (user_id, board_json),
            )
        connection.commit()
