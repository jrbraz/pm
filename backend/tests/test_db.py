import sqlite3
from pathlib import Path

from app.db import get_board_json, get_or_create_user_id, initialize_database, upsert_board_json
from app.main import create_app
from tests.conftest import FIXTURE_DIR


def test_initialize_database_creates_file_and_tables(tmp_path: Path) -> None:
    db_path = tmp_path / "nested" / "pm.db"

    initialize_database(db_path)

    assert db_path.exists()
    with sqlite3.connect(db_path) as connection:
        table_rows = connection.execute(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('users', 'boards')"
        ).fetchall()
    assert {row[0] for row in table_rows} == {"users", "boards"}


def test_persistence_operations_create_user_and_upsert_board(tmp_path: Path) -> None:
    db_path = tmp_path / "pm.db"
    initialize_database(db_path)

    user_id = get_or_create_user_id(db_path, "user")
    assert user_id > 0
    same_user_id = get_or_create_user_id(db_path, "user")
    assert same_user_id == user_id

    first_board = '{"columns":[{"id":"c1"}],"cards":{}}'
    upsert_board_json(db_path, user_id, first_board)
    assert get_board_json(db_path, user_id) == first_board

    updated_board = '{"columns":[{"id":"c2"}],"cards":{"card-1":{"id":"card-1"}}}'
    upsert_board_json(db_path, user_id, updated_board)
    assert get_board_json(db_path, user_id) == updated_board


def test_create_app_bootstraps_database_if_missing(tmp_path: Path) -> None:
    db_path = tmp_path / "newdb" / "pm.db"
    assert not db_path.exists()
    _app = create_app(frontend_dist_dir=FIXTURE_DIR, db_path=db_path)
    assert _app is not None
    assert db_path.exists()
