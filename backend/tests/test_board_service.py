from pathlib import Path

from app.board_models import BoardData
from app.board_service import get_or_create_board_for_user, save_board_for_user
from app.db import initialize_database


def test_get_or_create_board_for_user_seeds_default_board(tmp_path: Path) -> None:
    db_path = tmp_path / "pm.db"
    initialize_database(db_path)

    board = get_or_create_board_for_user(db_path, "user")

    assert len(board.columns) == 5
    assert "card-1" in board.cards
    assert board.cards["card-1"].title == "Align roadmap themes"

    board_again = get_or_create_board_for_user(db_path, "user")
    assert board_again.model_dump() == board.model_dump()


def test_save_board_for_user_persists_board(tmp_path: Path) -> None:
    db_path = tmp_path / "pm.db"
    initialize_database(db_path)

    board = BoardData(
        columns=[{"id": "col-backlog", "title": "Backlog", "cardIds": ["card-1"]}],
        cards={"card-1": {"id": "card-1", "title": "Task", "details": "Details"}},
    )

    save_board_for_user(db_path, "user", board)
    loaded_board = get_or_create_board_for_user(db_path, "user")

    assert loaded_board.model_dump() == board.model_dump()
