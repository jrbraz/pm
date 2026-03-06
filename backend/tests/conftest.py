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
