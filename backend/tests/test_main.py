from pathlib import Path

from fastapi.testclient import TestClient

from app.main import create_app
from tests.conftest import FIXTURE_DIR


def test_health_route(client: TestClient) -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_hello_route(client: TestClient) -> None:
    response = client.get("/api/hello")
    assert response.status_code == 200
    assert response.json() == {"message": "Hello from FastAPI"}


def test_index_route_serves_frontend_dist_file(client: TestClient) -> None:
    response = client.get("/")
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
    assert "Kanban Studio Fixture" in response.text


def test_root_returns_503_when_frontend_dist_missing(tmp_path: Path) -> None:
    missing_dir = tmp_path / "missing_dist"
    db_path = tmp_path / "pm.db"
    test_client = TestClient(create_app(missing_dir, db_path=db_path))
    response = test_client.get("/")
    assert response.status_code == 503
    assert "Frontend build output not found" in response.text
