"""User-related database helpers."""

import sqlite3
from pathlib import Path


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


def get_user_by_id(db_path: Path, user_id: int) -> dict | None:
    """Return user dict (id, username) or None."""
    with sqlite3.connect(db_path) as connection:
        row = connection.execute(
            "SELECT id, username FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()
        if row is None:
            return None
        return {"id": row[0], "username": row[1]}


def update_user_password(db_path: Path, username: str, password_hash: str) -> None:
    """Update a user's password hash."""
    with sqlite3.connect(db_path) as connection:
        connection.execute(
            "UPDATE users SET password_hash = ? WHERE username = ?",
            (password_hash, username),
        )
        connection.commit()


def search_users(db_path: Path, query: str, limit: int = 10) -> list[dict]:
    """Search users by username prefix. Returns list of {id, username}."""
    with sqlite3.connect(db_path) as connection:
        rows = connection.execute(
            "SELECT id, username FROM users WHERE username LIKE ? ORDER BY username LIMIT ?",
            (f"{query}%", limit),
        ).fetchall()
        return [{"id": row[0], "username": row[1]} for row in rows]
