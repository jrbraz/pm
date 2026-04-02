"""Session-related database helpers."""

import sqlite3
from pathlib import Path


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


def cleanup_expired_sessions(conn_or_path: sqlite3.Connection | Path) -> int:
    """Delete all expired sessions. Returns the number of rows deleted.

    Accepts either an open Connection (used during startup) or a Path (for ad-hoc calls).
    """
    if isinstance(conn_or_path, Path):
        with sqlite3.connect(conn_or_path) as connection:
            cursor = connection.execute(
                "DELETE FROM sessions WHERE expires_at < datetime('now')"
            )
            connection.commit()
            return cursor.rowcount
    cursor = conn_or_path.execute(
        "DELETE FROM sessions WHERE expires_at < datetime('now')"
    )
    conn_or_path.commit()
    return cursor.rowcount
