"""Use a temp SQLite DB so integration tests do not touch developer vidhi.db."""
import os
import tempfile
from pathlib import Path

import pytest

_tmp = Path(tempfile.mkdtemp(prefix="vidhi_test_")) / "test.db"
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp.as_posix()}"
os.environ.setdefault("GEMINI_API_KEY", "")

from app.main import app  
from fastapi.testclient import TestClient  


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c
