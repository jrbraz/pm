"""Activity log database helpers."""

import json
import sqlite3
from pathlib import Path


def log_activity(
    db_path: Path,
    board_id: int,
    user_id: int,
    entity_type: str,
    entity_id: str,
    action: str,
    detail: dict | None = None,
) -> None:
    """Insert an activity log entry."""
    detail_json = json.dumps(detail) if detail is not None else None
    with sqlite3.connect(db_path) as connection:
        connection.execute(
            """
            INSERT INTO activity_log (board_id, user_id, entity_type, entity_id, action, detail)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (board_id, user_id, entity_type, entity_id, action, detail_json),
        )
        connection.commit()


def get_activity_for_board(
    db_path: Path, board_id: int, limit: int = 50, offset: int = 0, card_id: str | None = None
) -> list[dict]:
    """Return activity log entries for a board, newest first."""
    with sqlite3.connect(db_path) as connection:
        if card_id:
            rows = connection.execute(
                """
                SELECT al.id, al.entity_type, al.entity_id, al.action, al.detail,
                       al.created_at, u.username
                FROM activity_log al
                JOIN users u ON u.id = al.user_id
                WHERE al.board_id = ? AND al.entity_id = ?
                ORDER BY al.created_at DESC
                LIMIT ? OFFSET ?
                """,
                (board_id, card_id, limit, offset),
            ).fetchall()
        else:
            rows = connection.execute(
                """
                SELECT al.id, al.entity_type, al.entity_id, al.action, al.detail,
                       al.created_at, u.username
                FROM activity_log al
                JOIN users u ON u.id = al.user_id
                WHERE al.board_id = ?
                ORDER BY al.created_at DESC
                LIMIT ? OFFSET ?
                """,
                (board_id, limit, offset),
            ).fetchall()
        return [
            {
                "id": row[0],
                "entity_type": row[1],
                "entity_id": row[2],
                "action": row[3],
                "detail": json.loads(row[4]) if row[4] else None,
                "created_at": row[5],
                "username": row[6],
            }
            for row in rows
        ]


def get_recent_activity_for_user(db_path: Path, user_id: int, limit: int = 30) -> list[dict]:
    """Return recent activity across all boards accessible to user."""
    with sqlite3.connect(db_path) as connection:
        rows = connection.execute(
            """
            SELECT al.id, al.board_id, b.name as board_name, al.entity_type,
                   al.entity_id, al.action, al.detail, al.created_at, u.username
            FROM activity_log al
            JOIN users u ON u.id = al.user_id
            JOIN boards b ON b.id = al.board_id
            WHERE b.user_id = ?
               OR al.board_id IN (
                   SELECT board_id FROM board_members WHERE user_id = ?
               )
            ORDER BY al.created_at DESC
            LIMIT ?
            """,
            (user_id, user_id, limit),
        ).fetchall()
        return [
            {
                "id": row[0],
                "board_id": row[1],
                "board_name": row[2],
                "entity_type": row[3],
                "entity_id": row[4],
                "action": row[5],
                "detail": json.loads(row[6]) if row[6] else None,
                "created_at": row[7],
                "username": row[8],
            }
            for row in rows
        ]
