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
    assert "PM MVP Backend Hello World" in response.text
