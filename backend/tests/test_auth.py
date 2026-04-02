import pytest
from pathlib import Path

from app.auth import hash_password, verify_password, register_user, login_user, validate_token, logout_user
from app.db import initialize_database


@pytest.fixture()
def db_path(tmp_path: Path) -> Path:
    path = tmp_path / "test.db"
    initialize_database(path)
    return path


def test_hash_password_creates_verifiable_hash() -> None:
    pw = "supersecret"
    hashed = hash_password(pw)
    assert verify_password(pw, hashed)
    assert not verify_password("wrong", hashed)


def test_hash_password_is_salted() -> None:
    pw = "same"
    assert hash_password(pw) != hash_password(pw)


def test_register_user_succeeds(db_path: Path) -> None:
    user = register_user(db_path, "alice", "pass1234")
    assert user["username"] == "alice"
    assert "id" in user


def test_register_duplicate_username_raises(db_path: Path) -> None:
    register_user(db_path, "alice", "pass1234")
    with pytest.raises(ValueError, match="already taken"):
        register_user(db_path, "alice", "other1234")


def test_register_short_username_raises(db_path: Path) -> None:
    with pytest.raises(ValueError):
        register_user(db_path, "a", "pass1234")


def test_register_short_password_raises(db_path: Path) -> None:
    with pytest.raises(ValueError):
        register_user(db_path, "bob", "123")


def test_login_returns_token(db_path: Path) -> None:
    register_user(db_path, "carol", "mypassword")
    token = login_user(db_path, "carol", "mypassword")
    assert isinstance(token, str)
    assert len(token) > 10


def test_login_wrong_password_raises(db_path: Path) -> None:
    register_user(db_path, "dave", "rightpass")
    with pytest.raises(ValueError):
        login_user(db_path, "dave", "wrongpass")


def test_login_unknown_user_raises(db_path: Path) -> None:
    with pytest.raises(ValueError):
        login_user(db_path, "nobody", "pass")


def test_validate_token_returns_user(db_path: Path) -> None:
    register_user(db_path, "eve", "pass5678")
    token = login_user(db_path, "eve", "pass5678")
    result = validate_token(db_path, token)
    assert result is not None
    assert result["username"] == "eve"


def test_validate_invalid_token_returns_none(db_path: Path) -> None:
    assert validate_token(db_path, "bogus-token") is None


def test_logout_invalidates_token(db_path: Path) -> None:
    register_user(db_path, "frank", "pass9012")
    token = login_user(db_path, "frank", "pass9012")
    logout_user(db_path, token)
    assert validate_token(db_path, token) is None
