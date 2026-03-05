import sqlite3
from pathlib import Path

DEFAULT_DB_PATH = (Path(__file__).resolve().parents[1] / "data" / "pm.db").resolve()

SCHEMA_SQL = """
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS boards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    board_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
"""


def initialize_database(db_path: Path) -> None:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(db_path) as connection:
        connection.executescript(SCHEMA_SQL)
        connection.commit()


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


def get_board_json(db_path: Path, user_id: int) -> str | None:
    with sqlite3.connect(db_path) as connection:
        row = connection.execute(
            "SELECT board_json FROM boards WHERE user_id = ?",
            (user_id,),
        ).fetchone()
        return str(row[0]) if row is not None else None


def upsert_board_json(db_path: Path, user_id: int, board_json: str) -> None:
    with sqlite3.connect(db_path) as connection:
        connection.execute(
            """
            INSERT INTO boards (user_id, board_json)
            VALUES (?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
                board_json = excluded.board_json,
                updated_at = CURRENT_TIMESTAMP
            """,
            (user_id, board_json),
        )
        connection.commit()
