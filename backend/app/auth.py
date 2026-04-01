import hashlib
import hmac
import os
import secrets
from datetime import datetime, timedelta, timezone
from pathlib import Path

from app.db import (
    create_session,
    create_user,
    delete_session,
    get_session,
    get_user_by_username,
)

SESSION_DURATION_DAYS = 30
TOKEN_BYTES = 32


def hash_password(password: str) -> str:
    """Hash a password with a random salt using PBKDF2-HMAC-SHA256."""
    salt = secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 260_000)
    return f"{salt}:{dk.hex()}"


def verify_password(password: str, stored_hash: str) -> bool:
    """Verify a password against a stored hash."""
    try:
        salt, dk_hex = stored_hash.split(":", 1)
    except ValueError:
        return False
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 260_000)
    return hmac.compare_digest(dk.hex(), dk_hex)


def generate_token() -> str:
    return secrets.token_urlsafe(TOKEN_BYTES)


def register_user(db_path: Path, username: str, password: str) -> dict:
    """Register a new user. Raises ValueError on duplicate username."""
    if not username or len(username) < 2:
        raise ValueError("Username must be at least 2 characters.")
    if not password or len(password) < 4:
        raise ValueError("Password must be at least 4 characters.")
    password_hash = hash_password(password)
    user_id = create_user(db_path, username, password_hash)
    return {"id": user_id, "username": username}


def login_user(db_path: Path, username: str, password: str) -> str:
    """Authenticate user and return a session token. Raises ValueError on failure."""
    user = get_user_by_username(db_path, username)
    if user is None:
        raise ValueError("Invalid credentials.")
    stored_hash = user.get("password_hash")
    # Allow legacy users without password (created via get_or_create_user_id)
    if stored_hash and not verify_password(password, stored_hash):
        raise ValueError("Invalid credentials.")
    if not stored_hash and password != "password":
        # Legacy user - only allow default password
        raise ValueError("Invalid credentials.")

    token = generate_token()
    expires_at = (
        datetime.now(timezone.utc) + timedelta(days=SESSION_DURATION_DAYS)
    ).isoformat()
    create_session(db_path, user["id"], token, expires_at)
    return token


def validate_token(db_path: Path, token: str) -> dict | None:
    """Validate a session token. Returns {user_id, username} or None."""
    if not token:
        return None
    session = get_session(db_path, token)
    if session is None:
        return None
    # Check expiry
    try:
        expires_at = datetime.fromisoformat(session["expires_at"])
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) > expires_at:
            delete_session(db_path, token)
            return None
    except ValueError:
        return None
    return {"user_id": session["user_id"], "username": session["username"]}


def logout_user(db_path: Path, token: str) -> None:
    delete_session(db_path, token)
