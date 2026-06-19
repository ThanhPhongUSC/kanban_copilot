import sqlite3
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from main import app


@pytest.fixture(autouse=True)
def isolated_db(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PM_DB_PATH", str(tmp_path / "pm-test.db"))


def login(client: TestClient) -> None:
    response = client.post(
        "/api/auth/login",
        json={"username": "user", "password": "password"},
    )
    assert response.status_code == 200


def test_health_endpoint_returns_ok() -> None:
    with TestClient(app) as client:
        response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "pm-mvp-backend"}


def test_root_serves_static_html() -> None:
    with TestClient(app) as client:
        response = client.get("/")
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
    assert "<html" in response.text.lower()


def test_database_bootstraps_on_startup(tmp_path: Path) -> None:
    db_path = tmp_path / "pm-test.db"
    assert not db_path.exists()

    with TestClient(app) as client:
        health_response = client.get("/api/health")
        assert health_response.status_code == 200

    assert db_path.exists()

    with sqlite3.connect(db_path) as connection:
        tables = {
            row[0]
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            ).fetchall()
        }
    assert "users" in tables
    assert "boards" in tables


def test_session_requires_cookie() -> None:
    with TestClient(app) as client:
        response = client.get("/api/auth/session")
    assert response.status_code == 401
    assert response.json()["detail"] == "Not authenticated"


def test_login_with_invalid_credentials_fails() -> None:
    with TestClient(app) as client:
        response = client.post(
            "/api/auth/login",
            json={"username": "user", "password": "wrong"},
        )
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid credentials"


def test_login_sets_cookie_and_session_resolves() -> None:
    with TestClient(app) as client:
        login_response = client.post(
            "/api/auth/login",
            json={"username": "user", "password": "password"},
        )
        assert login_response.status_code == 200
        assert "pm_session=user" in login_response.headers.get("set-cookie", "")

        session_response = client.get("/api/auth/session")
        assert session_response.status_code == 200
        assert session_response.json() == {"status": "ok", "user": "user"}


def test_logout_clears_cookie() -> None:
    with TestClient(app) as client:
        login(client)
        logout_response = client.post("/api/auth/logout")
        assert logout_response.status_code == 200
        assert "pm_session=" in logout_response.headers.get("set-cookie", "")

        session_response = client.get("/api/auth/session")
        assert session_response.status_code == 401


def test_board_endpoints_require_authentication() -> None:
    with TestClient(app) as client:
        get_response = client.get("/api/board")
        put_response = client.put("/api/board", json={"columns": [], "cards": {}})

    assert get_response.status_code == 401
    assert put_response.status_code == 401


def test_get_board_returns_bootstrapped_board() -> None:
    with TestClient(app) as client:
        login(client)
        response = client.get("/api/board")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["version"] >= 1
    assert len(payload["board"]["columns"]) == 5
    assert "card-1" in payload["board"]["cards"]


def test_update_board_persists_changes() -> None:
    with TestClient(app) as client:
        login(client)
        original = client.get("/api/board")
        assert original.status_code == 200
        original_payload = original.json()

        board = original_payload["board"]
        board["columns"][0]["title"] = "Updated Backlog"

        update_response = client.put("/api/board", json=board)
        assert update_response.status_code == 200
        update_payload = update_response.json()
        assert update_payload["board"]["columns"][0]["title"] == "Updated Backlog"
        assert update_payload["version"] == original_payload["version"] + 1

        reloaded = client.get("/api/board")
        assert reloaded.status_code == 200
        assert reloaded.json()["board"]["columns"][0]["title"] == "Updated Backlog"


def test_board_access_denied_after_logout() -> None:
    with TestClient(app) as client:
        login(client)
        assert client.get("/api/board").status_code == 200

        client.post("/api/auth/logout")
        response = client.get("/api/board")

    assert response.status_code == 401
