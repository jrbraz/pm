"""Database package -- re-exports all public symbols for backward compatibility.

Sub-modules:
    schema   -- DDL, migrations, initialize_database
    users    -- user CRUD
    sessions -- session CRUD + cleanup
    boards   -- board + board member CRUD, optimistic locking
    comments -- card comment CRUD
    activity -- activity log CRUD
"""

from app.db.schema import DEFAULT_DB_PATH, initialize_database  # noqa: F401
from app.db.users import (  # noqa: F401
    create_user,
    get_or_create_user_id,
    get_user_by_id,
    get_user_by_username,
    search_users,
    update_user_password,
)
from app.db.sessions import (  # noqa: F401
    cleanup_expired_sessions,
    create_session,
    delete_session,
    get_session,
)
from app.db.boards import (  # noqa: F401
    BoardConflictError,
    add_board_member,
    create_board,
    delete_board,
    get_board_by_id,
    get_board_by_id_with_access,
    get_board_json,
    get_board_members,
    get_board_owner_id,
    get_boards_accessible_to_user,
    get_boards_for_user,
    get_default_board,
    get_effective_role,
    get_member_role,
    remove_board_member,
    rename_board,
    update_board_json,
    update_board_json_by_id,
    update_member_role,
    upsert_board_json,
)
from app.db.comments import (  # noqa: F401
    create_comment,
    delete_comment,
    get_comment_by_id,
    get_comments_for_card,
    update_comment,
)
from app.db.activity import (  # noqa: F401
    get_activity_for_board,
    get_recent_activity_for_user,
    log_activity,
)
