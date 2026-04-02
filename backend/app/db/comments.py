"""Card comment database helpers."""

import sqlite3
from pathlib import Path


def create_comment(
    db_path: Path, board_id: int, card_id: str, user_id: int, body: str
) -> int:
    """Create a comment. Returns the new comment id."""
    with sqlite3.connect(db_path) as connection:
        cursor = connection.execute(
            "INSERT INTO card_comments (board_id, card_id, user_id, body) VALUES (?, ?, ?, ?)",
            (board_id, card_id, user_id, body),
        )
        connection.commit()
        return int(cursor.lastrowid)


def get_comments_for_card(db_path: Path, board_id: int, card_id: str) -> list[dict]:
    """Return comments for a card ordered by created_at."""
    with sqlite3.connect(db_path) as connection:
        rows = connection.execute(
            """
            SELECT cc.id, cc.card_id, cc.user_id, u.username, cc.body,
                   cc.created_at, cc.updated_at
            FROM card_comments cc
            JOIN users u ON u.id = cc.user_id
            WHERE cc.board_id = ? AND cc.card_id = ?
            ORDER BY cc.created_at
            """,
            (board_id, card_id),
        ).fetchall()
        return [
            {
                "id": row[0],
                "card_id": row[1],
                "user_id": row[2],
                "username": row[3],
                "body": row[4],
                "created_at": row[5],
                "updated_at": row[6],
            }
            for row in rows
        ]


def get_comment_by_id(db_path: Path, comment_id: int) -> dict | None:
    """Return a comment dict or None."""
    with sqlite3.connect(db_path) as connection:
        row = connection.execute(
            """
            SELECT cc.id, cc.board_id, cc.card_id, cc.user_id, u.username, cc.body,
                   cc.created_at, cc.updated_at
            FROM card_comments cc
            JOIN users u ON u.id = cc.user_id
            WHERE cc.id = ?
            """,
            (comment_id,),
        ).fetchone()
        if row is None:
            return None
        return {
            "id": row[0],
            "board_id": row[1],
            "card_id": row[2],
            "user_id": row[3],
            "username": row[4],
            "body": row[5],
            "created_at": row[6],
            "updated_at": row[7],
        }


def update_comment(db_path: Path, comment_id: int, body: str) -> bool:
    """Update a comment body. Returns True if updated."""
    with sqlite3.connect(db_path) as connection:
        cursor = connection.execute(
            "UPDATE card_comments SET body = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (body, comment_id),
        )
        connection.commit()
        return cursor.rowcount > 0


def delete_comment(db_path: Path, comment_id: int) -> bool:
    """Delete a comment. Returns True if deleted."""
    with sqlite3.connect(db_path) as connection:
        cursor = connection.execute(
            "DELETE FROM card_comments WHERE id = ?",
            (comment_id,),
        )
        connection.commit()
        return cursor.rowcount > 0
