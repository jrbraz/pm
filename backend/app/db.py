import json
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
    # Check if boards table has 'name' column (new schema)
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

    # Create board_members table if missing
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

    # Create card_comments table if missing
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

    # Create activity_log table if missing
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


def search_users(db_path: Path, query: str, limit: int = 10) -> list[dict]:
    """Search users by username prefix. Returns list of {id, username}."""
    with sqlite3.connect(db_path) as connection:
        rows = connection.execute(
            "SELECT id, username FROM users WHERE username LIKE ? ORDER BY username LIMIT ?",
            (f"{query}%", limit),
        ).fetchall()
        return [{"id": row[0], "username": row[1]} for row in rows]


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
        # Check ownership first
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
        # Check membership
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


def update_board_json(db_path: Path, board_id: int, user_id: int, board_json: str) -> None:
    with sqlite3.connect(db_path) as connection:
        connection.execute(
            "UPDATE boards SET board_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?",
            (board_json, board_id, user_id),
        )
        connection.commit()


def update_board_json_by_id(db_path: Path, board_id: int, board_json: str) -> None:
    """Update board JSON without ownership check (for member saves)."""
    with sqlite3.connect(db_path) as connection:
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
# Card comment helpers
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# Activity log helpers
# ---------------------------------------------------------------------------

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
