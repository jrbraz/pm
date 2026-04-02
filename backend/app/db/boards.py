"""Board-related database helpers."""

import sqlite3
from pathlib import Path


class BoardConflictError(Exception):
    """Raised when a board save is rejected due to a concurrent update."""


def get_boards_for_user(db_path: Path, user_id: int) -> list[dict]:
    """Return list of board summary dicts for a user (owned boards only)."""
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


def get_boards_accessible_to_user(db_path: Path, user_id: int) -> list[dict]:
    """Return all boards the user can access (owned + member of). Includes owner_username."""
    with sqlite3.connect(db_path) as connection:
        rows = connection.execute(
            """
            SELECT b.id, b.name, b.is_default, b.created_at, b.updated_at,
                   u.username as owner_username, 'owner' as access_role
            FROM boards b
            JOIN users u ON u.id = b.user_id
            WHERE b.user_id = ?
            UNION
            SELECT b.id, b.name, b.is_default, b.created_at, b.updated_at,
                   u.username as owner_username, bm.role as access_role
            FROM boards b
            JOIN board_members bm ON bm.board_id = b.id AND bm.user_id = ?
            JOIN users u ON u.id = b.user_id
            ORDER BY 4
            """,
            (user_id, user_id),
        ).fetchall()
        return [
            {
                "id": row[0],
                "name": row[1],
                "is_default": bool(row[2]),
                "created_at": row[3],
                "updated_at": row[4],
                "owner_username": row[5],
                "access_role": row[6],
            }
            for row in rows
        ]


def get_board_by_id(db_path: Path, board_id: int, user_id: int) -> dict | None:
    """Return board dict if user is the owner, else None."""
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


def get_board_by_id_with_access(db_path: Path, board_id: int, user_id: int) -> dict | None:
    """Return board dict if user is owner OR a board member. Includes access_role."""
    with sqlite3.connect(db_path) as connection:
        row = connection.execute(
            "SELECT id, name, board_json, is_default, created_at, updated_at, user_id FROM boards WHERE id = ?",
            (board_id,),
        ).fetchone()
        if row is None:
            return None
        board = {
            "id": row[0],
            "name": row[1],
            "board_json": row[2],
            "is_default": bool(row[3]),
            "created_at": row[4],
            "updated_at": row[5],
            "owner_user_id": row[6],
        }
        if row[6] == user_id:
            board["access_role"] = "owner"
            return board
        member_row = connection.execute(
            "SELECT role FROM board_members WHERE board_id = ? AND user_id = ?",
            (board_id, user_id),
        ).fetchone()
        if member_row is None:
            return None
        board["access_role"] = member_row[0]
        return board


def get_board_owner_id(db_path: Path, board_id: int) -> int | None:
    """Return the user_id of the board owner, or None if board not found."""
    with sqlite3.connect(db_path) as connection:
        row = connection.execute(
            "SELECT user_id FROM boards WHERE id = ?",
            (board_id,),
        ).fetchone()
        return row[0] if row else None


def get_default_board(db_path: Path, user_id: int) -> dict | None:
    """Return the first/default board for a user."""
    with sqlite3.connect(db_path) as connection:
        row = connection.execute(
            "SELECT id, name, board_json, is_default, created_at, updated_at FROM boards WHERE user_id = ? AND is_default = 1 LIMIT 1",
            (user_id,),
        ).fetchone()
        if row is None:
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


def update_board_json(
    db_path: Path,
    board_id: int,
    user_id: int,
    board_json: str,
    expected_updated_at: str | None = None,
) -> None:
    with sqlite3.connect(db_path) as connection:
        if expected_updated_at:
            cursor = connection.execute(
                "UPDATE boards SET board_json = ?, updated_at = CURRENT_TIMESTAMP "
                "WHERE id = ? AND user_id = ? AND updated_at = ?",
                (board_json, board_id, user_id, expected_updated_at),
            )
            if cursor.rowcount == 0:
                raise BoardConflictError(
                    "Board was modified by another user. Please reload and try again."
                )
        else:
            connection.execute(
                "UPDATE boards SET board_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?",
                (board_json, board_id, user_id),
            )
        connection.commit()


def update_board_json_by_id(
    db_path: Path,
    board_id: int,
    board_json: str,
    expected_updated_at: str | None = None,
) -> None:
    """Update board JSON without ownership check (for member saves).

    IMPORTANT: Callers MUST verify board access before calling this function.
    This exists so that board members (non-owners) can persist changes after
    access has been validated by the service layer (see save_named_board_with_access).
    """
    with sqlite3.connect(db_path) as connection:
        if expected_updated_at:
            cursor = connection.execute(
                "UPDATE boards SET board_json = ?, updated_at = CURRENT_TIMESTAMP "
                "WHERE id = ? AND updated_at = ?",
                (board_json, board_id, expected_updated_at),
            )
            if cursor.rowcount == 0:
                raise BoardConflictError(
                    "Board was modified by another user. Please reload and try again."
                )
        else:
            connection.execute(
                "UPDATE boards SET board_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                (board_json, board_id),
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
# Board member helpers
# ---------------------------------------------------------------------------

def add_board_member(
    db_path: Path, board_id: int, user_id: int, role: str, invited_by: int
) -> None:
    """Add a user as a board member. Raises ValueError if already a member."""
    with sqlite3.connect(db_path) as connection:
        try:
            connection.execute(
                "INSERT INTO board_members (board_id, user_id, role, invited_by) VALUES (?, ?, ?, ?)",
                (board_id, user_id, role, invited_by),
            )
            connection.commit()
        except sqlite3.IntegrityError:
            raise ValueError("User is already a member of this board.")


def get_board_members(db_path: Path, board_id: int) -> list[dict]:
    """Return list of members with username, role, created_at."""
    with sqlite3.connect(db_path) as connection:
        rows = connection.execute(
            """
            SELECT bm.id, u.id as user_id, u.username, bm.role, bm.created_at,
                   inv.username as invited_by_username
            FROM board_members bm
            JOIN users u ON u.id = bm.user_id
            LEFT JOIN users inv ON inv.id = bm.invited_by
            WHERE bm.board_id = ?
            ORDER BY bm.created_at
            """,
            (board_id,),
        ).fetchall()
        return [
            {
                "id": row[0],
                "user_id": row[1],
                "username": row[2],
                "role": row[3],
                "created_at": row[4],
                "invited_by": row[5],
            }
            for row in rows
        ]


def get_member_role(db_path: Path, board_id: int, user_id: int) -> str | None:
    """Return the role of a user in a board, or None if not a member."""
    with sqlite3.connect(db_path) as connection:
        row = connection.execute(
            "SELECT role FROM board_members WHERE board_id = ? AND user_id = ?",
            (board_id, user_id),
        ).fetchone()
        return row[0] if row else None


def remove_board_member(db_path: Path, board_id: int, user_id: int) -> bool:
    """Remove a user from a board. Returns True if removed."""
    with sqlite3.connect(db_path) as connection:
        cursor = connection.execute(
            "DELETE FROM board_members WHERE board_id = ? AND user_id = ?",
            (board_id, user_id),
        )
        connection.commit()
        return cursor.rowcount > 0


def update_member_role(db_path: Path, board_id: int, user_id: int, role: str) -> bool:
    """Update a member's role. Returns True if updated."""
    with sqlite3.connect(db_path) as connection:
        cursor = connection.execute(
            "UPDATE board_members SET role = ? WHERE board_id = ? AND user_id = ?",
            (role, board_id, user_id),
        )
        connection.commit()
        return cursor.rowcount > 0


def get_effective_role(db_path: Path, board_id: int, user_id: int) -> str | None:
    """Return 'owner', member role, or None if no access."""
    with sqlite3.connect(db_path) as connection:
        row = connection.execute(
            "SELECT user_id FROM boards WHERE id = ?",
            (board_id,),
        ).fetchone()
        if row is None:
            return None
        if row[0] == user_id:
            return "owner"
        member_row = connection.execute(
            "SELECT role FROM board_members WHERE board_id = ? AND user_id = ?",
            (board_id, user_id),
        ).fetchone()
        return member_row[0] if member_row else None


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
