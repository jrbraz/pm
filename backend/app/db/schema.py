"""Database schema, migrations, and initialization."""

import logging
import sqlite3
from pathlib import Path

logger = logging.getLogger(__name__)

DEFAULT_DB_PATH = (Path(__file__).resolve().parents[2] / "data" / "pm.db").resolve()

CURRENT_SCHEMA_VERSION = 2

NEW_SCHEMA_SQL = """
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER NOT NULL
);

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

CREATE TABLE IF NOT EXISTS board_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    board_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    role TEXT NOT NULL DEFAULT 'member',
    invited_by INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (invited_by) REFERENCES users(id),
    UNIQUE (board_id, user_id)
);

CREATE TABLE IF NOT EXISTS card_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    board_id INTEGER NOT NULL,
    card_id TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_card_comments_card ON card_comments(board_id, card_id);

CREATE TABLE IF NOT EXISTS activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    board_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL,
    detail TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_activity_board ON activity_log(board_id, created_at);
"""


def _migrate_database(conn: sqlite3.Connection) -> None:
    """Apply schema migrations for existing databases."""
    board_cols = [row[1] for row in conn.execute("PRAGMA table_info(boards)").fetchall()]
    if "name" not in board_cols:
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

    user_cols = [row[1] for row in conn.execute("PRAGMA table_info(users)").fetchall()]
    if "password_hash" not in user_cols:
        conn.execute("ALTER TABLE users ADD COLUMN password_hash TEXT")

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

    conn.executescript("""
        CREATE TABLE IF NOT EXISTS board_members (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            board_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            role TEXT NOT NULL DEFAULT 'member',
            invited_by INTEGER,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (invited_by) REFERENCES users(id),
            UNIQUE (board_id, user_id)
        );
    """)

    conn.executescript("""
        CREATE TABLE IF NOT EXISTS card_comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            board_id INTEGER NOT NULL,
            card_id TEXT NOT NULL,
            user_id INTEGER NOT NULL,
            body TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_card_comments_card ON card_comments(board_id, card_id);
    """)

    conn.executescript("""
        CREATE TABLE IF NOT EXISTS activity_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            board_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            entity_type TEXT NOT NULL,
            entity_id TEXT NOT NULL,
            action TEXT NOT NULL,
            detail TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_activity_board ON activity_log(board_id, created_at);
    """)

    conn.commit()


def _get_schema_version(conn: sqlite3.Connection) -> int:
    tables = [
        row[0]
        for row in conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='schema_version'"
        ).fetchall()
    ]
    if not tables:
        return 0
    row = conn.execute("SELECT version FROM schema_version LIMIT 1").fetchone()
    return row[0] if row else 0


def _set_schema_version(conn: sqlite3.Connection, version: int) -> None:
    conn.execute("DELETE FROM schema_version")
    conn.execute("INSERT INTO schema_version (version) VALUES (?)", (version,))


def initialize_database(db_path: Path) -> None:
    from app.db.sessions import cleanup_expired_sessions

    db_path.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(db_path) as connection:
        current_version = _get_schema_version(connection)
        connection.executescript(NEW_SCHEMA_SQL)
        if current_version < CURRENT_SCHEMA_VERSION:
            _migrate_database(connection)
            _set_schema_version(connection, CURRENT_SCHEMA_VERSION)
            logger.info("Database migrated from v%d to v%d", current_version, CURRENT_SCHEMA_VERSION)
        elif current_version == 0:
            _set_schema_version(connection, CURRENT_SCHEMA_VERSION)
        connection.commit()
        cleanup_expired_sessions(connection)
