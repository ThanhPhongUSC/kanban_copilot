from fastapi.testclient import TestClient

from main import app


client = TestClient(app)


def test_health_endpoint_returns_ok() -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "pm-mvp-backend"}


def test_root_serves_static_html() -> None:
    response = client.get("/")
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
    assert "<html" in response.text.lower()


def test_session_requires_cookie() -> None:
    response = client.get("/api/auth/session")
    assert response.status_code == 401
    assert response.json()["detail"] == "Not authenticated"


def test_login_with_invalid_credentials_fails() -> None:
    response = client.post(
        "/api/auth/login",
        json={"username": "user", "password": "wrong"},
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid credentials"


def test_login_sets_cookie_and_session_resolves() -> None:
    with TestClient(app) as scoped_client:
        login_response = scoped_client.post(
            "/api/auth/login",
            json={"username": "user", "password": "password"},
        )
        assert login_response.status_code == 200
        assert "pm_session=" in login_response.headers.get("set-cookie", "")

        session_response = scoped_client.get("/api/auth/session")
        assert session_response.status_code == 200
        assert session_response.json() == {"status": "ok", "user": "user"}


def test_logout_clears_cookie() -> None:
    with TestClient(app) as scoped_client:
        scoped_client.post(
            "/api/auth/login",
            json={"username": "user", "password": "password"},
        )

        logout_response = scoped_client.post("/api/auth/logout")
        assert logout_response.status_code == 200
        assert "pm_session=" in logout_response.headers.get("set-cookie", "")

        session_response = scoped_client.get("/api/auth/session")
        assert session_response.status_code == 401
