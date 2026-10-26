from tasl_scraper import db


def test_connect_creates_missing_directory(tmp_path):
    path = tmp_path / "missing" / "tasl.db"
    conn = db.connect(str(path))
    conn.close()
    assert path.exists()
