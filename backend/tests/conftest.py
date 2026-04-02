import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

FIXTURE_DIR = Path(__file__).resolve().parent / "fixtures" / "frontend_dist"


@pytest.fixture()
def client(tmp_path: Path) -> TestClient:
    from app.main import create_app

    db_path = tmp_path / "pm.db"
    return TestClient(create_app(frontend_dist_dir=FIXTURE_DIR, db_path=db_path))


@pytest.fixture()
def auth_client(client: TestClient) -> tuple[TestClient, str, str]:
    """Register a test user and return (client, token, username).

    The returned client has the Authorization header pre-set.
    """
    username = "testuser"
    password = "testpass1234"

    # Register
    resp = client.post(
        "/api/auth/register",
        json={"username": username, "password": password},
    )
    assert resp.status_code == 200, resp.text

    # Login
    resp = client.post(
        "/api/auth/login",
        json={"username": username, "password": password},
    )
    assert resp.status_code == 200, resp.text
    token = resp.json()["token"]

    client.headers["Authorization"] = f"Bearer {token}"
    return client, token, username
