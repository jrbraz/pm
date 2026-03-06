from pathlib import Path

from fastapi import APIRouter, Request

from app.board_models import BoardData, BoardResponse
from app.board_service import get_or_create_board_for_user, save_board_for_user

router = APIRouter(prefix="/api")


def _db_path(request: Request) -> Path:
    return request.app.state.db_path


@router.get("/users/{username}/board", response_model=BoardResponse)
def get_board(username: str, request: Request) -> BoardResponse:
    board = get_or_create_board_for_user(_db_path(request), username)
    return BoardResponse(username=username, board=board)


@router.put("/users/{username}/board", response_model=BoardResponse)
def put_board(username: str, board: BoardData, request: Request) -> BoardResponse:
    saved_board = save_board_for_user(_db_path(request), username, board)
    return BoardResponse(username=username, board=saved_board)
