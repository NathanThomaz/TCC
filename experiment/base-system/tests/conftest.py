import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from loja import db, exemplo  # noqa: E402


@pytest.fixture
def conn():
    c = db.conectar()
    exemplo.popular(c)
    yield c
    c.close()
