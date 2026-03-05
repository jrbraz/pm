import sys
from pathlib import Path

from fastapi.testclient import TestClient

# Ensure imports work both locally and in containerized test runs.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.main import create_app


def _client_with_frontend_fixture() -> TestClient:
    fixture_dir = Path(__file__).resolve().parent / "fixtures" / "frontend_dist"
    return TestClient(create_app(fixture_dir))


def test_health_route() -> None:
    client = _client_with_frontend_fixture()
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_hello_route() -> None:
    client = _client_with_frontend_fixture()
    response = client.get("/api/hello")
    assert response.status_code == 200
    assert response.json() == {"message": "Hello from FastAPI"}


def test_index_route_serves_frontend_dist_file() -> None:
    client = _client_with_frontend_fixture()
    response = client.get("/")
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
    assert "Kanban Studio Fixture" in response.text


def test_root_returns_503_when_frontend_dist_missing() -> None:
    missing_dir = Path(__file__).resolve().parent / "fixtures" / "missing_dist"
    client = TestClient(create_app(missing_dir))
    response = client.get("/")
    assert response.status_code == 503
    assert "Frontend build output not found" in response.text
