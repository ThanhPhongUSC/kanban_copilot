import json
import sqlite3
from pathlib import Path

import pytest
import httpx
from fastapi.testclient import TestClient

from main import app


@pytest.fixture(autouse=True)
def isolated_db(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PM_DB_PATH", str(tmp_path / "pm-test.db"))


def login(client: TestClient, username: str = "user", password: str = "password") -> None:
    response = client.post(
        "/api/auth/login",
        json={"username": username, "password": password},
    )
    assert response.status_code == 200, response.text


def register(client: TestClient, username: str, password: str = "secret123") -> None:
    response = client.post(
        "/api/auth/register",
        json={"username": username, "password": password},
    )
    assert response.status_code == 200, response.text


def first_board_id(client: TestClient) -> int:
    response = client.get("/api/boards")
    assert response.status_code == 200, response.text
    boards = response.json()["boards"]
    assert boards
    return int(boards[0]["id"])


# ----- Health / static -----


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


# ----- Migration / bootstrap -----


def test_database_bootstraps_on_startup(tmp_path: Path) -> None:
    db_path = tmp_path / "pm-test.db"
    assert not db_path.exists()

    with TestClient(app) as client:
        assert client.get("/api/health").status_code == 200

    assert db_path.exists()
    with sqlite3.connect(db_path) as connection:
        tables = {
            row[0]
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            ).fetchall()
        }
        version = connection.execute("PRAGMA user_version").fetchone()[0]
    assert {"users", "boards", "board_members", "card_comments", "activity"} <= tables
    assert version == 1


def test_legacy_single_board_database_is_migrated(tmp_path: Path) -> None:
    db_path = tmp_path / "pm-test.db"
    with sqlite3.connect(db_path) as connection:
        connection.execute(
            """
            CREATE TABLE users (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              username TEXT NOT NULL UNIQUE,
              created_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE boards (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER NOT NULL UNIQUE,
              name TEXT NOT NULL DEFAULT 'My Board',
              board_json TEXT NOT NULL,
              version INTEGER NOT NULL DEFAULT 1,
              created_at TEXT NOT NULL DEFAULT (datetime('now')),
              updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
            """
        )
        connection.execute("INSERT INTO users (username) VALUES ('legacy')")
        legacy_board = {
            "columns": [{"id": "col-a", "title": "Legacy", "cardIds": ["card-x"]}],
            "cards": {"card-x": {"id": "card-x", "title": "Old", "details": "Kept"}},
        }
        connection.execute(
            "INSERT INTO boards (user_id, name, board_json, version) VALUES (1, 'Legacy Board', ?, 3)",
            (json.dumps(legacy_board),),
        )
        connection.commit()

    with TestClient(app) as client:
        assert client.get("/api/health").status_code == 200

    with sqlite3.connect(db_path) as connection:
        connection.row_factory = sqlite3.Row
        user_cols = {row[1] for row in connection.execute("PRAGMA table_info(users)")}
        board_cols = {row[1] for row in connection.execute("PRAGMA table_info(boards)")}
        membership = connection.execute(
            "SELECT role FROM board_members WHERE board_id = 1 AND user_id = 1"
        ).fetchone()
        board = connection.execute(
            "SELECT name, version, board_json FROM boards WHERE id = 1"
        ).fetchone()

    assert {"password_hash", "password_salt"} <= user_cols
    assert "owner_id" in board_cols
    assert membership is not None and membership["role"] == "owner"
    assert board["name"] == "Legacy Board"
    assert board["version"] == 3
    assert "card-x" in json.loads(board["board_json"])["cards"]


# ----- Auth -----


def test_register_creates_user_board_and_session() -> None:
    with TestClient(app) as client:
        response = client.post(
            "/api/auth/register",
            json={"username": "alice", "password": "secret123"},
        )
        assert response.status_code == 200
        assert response.json() == {"status": "ok", "user": "alice"}
        assert "pm_session=alice" in response.headers.get("set-cookie", "")

        session_response = client.get("/api/auth/session")
        assert session_response.json()["user"] == "alice"

        boards = client.get("/api/boards").json()["boards"]
        assert len(boards) == 1
        assert boards[0]["role"] == "owner"


def test_register_rejects_duplicate_username() -> None:
    with TestClient(app) as client:
        register(client, "bob")
        response = client.post(
            "/api/auth/register",
            json={"username": "bob", "password": "secret123"},
        )
    assert response.status_code == 409
    assert response.json()["detail"] == "Username already taken"


@pytest.mark.parametrize(
    "username,password",
    [("ab", "secret123"), ("validname", "short")],
)
def test_register_validates_input(username: str, password: str) -> None:
    with TestClient(app) as client:
        response = client.post(
            "/api/auth/register",
            json={"username": username, "password": password},
        )
    assert response.status_code == 422


def test_login_with_invalid_credentials_fails() -> None:
    with TestClient(app) as client:
        response = client.post(
            "/api/auth/login",
            json={"username": "user", "password": "wrong"},
        )
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid credentials"


def test_demo_user_can_log_in() -> None:
    with TestClient(app) as client:
        response = client.post(
            "/api/auth/login",
            json={"username": "user", "password": "password"},
        )
        assert response.status_code == 200
        assert "pm_session=user" in response.headers.get("set-cookie", "")
        assert client.get("/api/auth/session").json()["user"] == "user"


def test_registered_user_can_log_in_after_relogin() -> None:
    with TestClient(app) as client:
        register(client, "carol", "secret123")
        client.post("/api/auth/logout")
        login(client, "carol", "secret123")
        assert client.get("/api/auth/session").json()["user"] == "carol"


def test_logout_clears_cookie_and_blocks_access() -> None:
    with TestClient(app) as client:
        login(client)
        assert client.post("/api/auth/logout").status_code == 200
        assert client.get("/api/auth/session").status_code == 401
        assert client.get("/api/boards").status_code == 401


def test_forged_session_cookie_is_rejected() -> None:
    with TestClient(app) as client:
        client.cookies.set("pm_session", "user")
        response = client.get("/api/boards")
    assert response.status_code == 401


# ----- Boards -----


def test_boards_require_authentication() -> None:
    with TestClient(app) as client:
        assert client.get("/api/boards").status_code == 401
        assert client.post("/api/boards", json={"name": "x"}).status_code == 401


def test_demo_board_is_available() -> None:
    with TestClient(app) as client:
        login(client)
        boards = client.get("/api/boards").json()["boards"]
    assert len(boards) == 1
    assert boards[0]["name"] == "My Board"
    assert boards[0]["cardCount"] == 8


def test_create_and_get_board() -> None:
    with TestClient(app) as client:
        login(client)
        created = client.post("/api/boards", json={"name": "Launch Plan"})
        assert created.status_code == 200
        payload = created.json()
        assert payload["name"] == "Launch Plan"
        assert payload["role"] == "owner"
        board_id = payload["boardId"]

        fetched = client.get(f"/api/boards/{board_id}")
        assert fetched.status_code == 200
        assert fetched.json()["name"] == "Launch Plan"
        assert len(fetched.json()["board"]["columns"]) == 3

        listed = client.get("/api/boards").json()["boards"]
        assert len(listed) == 2


def test_update_board_persists_and_bumps_version() -> None:
    with TestClient(app) as client:
        login(client)
        board_id = first_board_id(client)
        original = client.get(f"/api/boards/{board_id}").json()
        board = original["board"]
        board["columns"][0]["title"] = "Updated Backlog"

        updated = client.put(f"/api/boards/{board_id}", json=board)
        assert updated.status_code == 200
        assert updated.json()["board"]["columns"][0]["title"] == "Updated Backlog"
        assert updated.json()["version"] == original["version"] + 1

        reloaded = client.get(f"/api/boards/{board_id}").json()
        assert reloaded["board"]["columns"][0]["title"] == "Updated Backlog"


def test_rename_board() -> None:
    with TestClient(app) as client:
        login(client)
        board_id = first_board_id(client)
        response = client.patch(f"/api/boards/{board_id}", json={"name": "Renamed"})
        assert response.status_code == 200
        assert response.json()["name"] == "Renamed"
        assert client.get("/api/boards").json()["boards"][0]["name"] == "Renamed"


def test_delete_board() -> None:
    with TestClient(app) as client:
        login(client)
        board_id = client.post("/api/boards", json={"name": "Temp"}).json()["boardId"]
        assert client.delete(f"/api/boards/{board_id}").status_code == 200
        assert client.get(f"/api/boards/{board_id}").status_code == 404


def test_rich_card_fields_round_trip() -> None:
    with TestClient(app) as client:
        login(client)
        board_id = client.post("/api/boards", json={"name": "Rich"}).json()["boardId"]
        board = client.get(f"/api/boards/{board_id}").json()["board"]
        board["cards"]["card-new"] = {
            "id": "card-new",
            "title": "Detailed task",
            "details": "Has metadata",
            "priority": "high",
            "dueDate": "2026-07-01",
            "labels": ["backend", "urgent"],
            "assignee": "user",
        }
        board["columns"][0]["cardIds"].append("card-new")

        client.put(f"/api/boards/{board_id}", json=board)
        reloaded = client.get(f"/api/boards/{board_id}").json()["board"]
        card = reloaded["cards"]["card-new"]
        assert card["priority"] == "high"
        assert card["dueDate"] == "2026-07-01"
        assert card["labels"] == ["backend", "urgent"]
        assert card["assignee"] == "user"


# ----- Isolation / sharing -----


def test_boards_are_isolated_between_users() -> None:
    with TestClient(app) as alice, TestClient(app) as bob:
        register(alice, "alice")
        register(bob, "bob")
        alice_board = first_board_id(alice)

        assert bob.get(f"/api/boards/{alice_board}").status_code == 404
        assert bob.put(f"/api/boards/{alice_board}", json={"columns": [], "cards": {}}).status_code == 404
        bob_boards = bob.get("/api/boards").json()["boards"]
        assert all(b["id"] != alice_board for b in bob_boards)


def test_owner_can_share_board_and_member_gains_access() -> None:
    with TestClient(app) as alice, TestClient(app) as bob:
        register(alice, "alice")
        register(bob, "bob")
        board_id = first_board_id(alice)

        share = alice.post(f"/api/boards/{board_id}/members", json={"username": "bob"})
        assert share.status_code == 200
        roles = {m["username"]: m["role"] for m in share.json()["members"]}
        assert roles == {"alice": "owner", "bob": "editor"}

        # Bob can now see and edit the shared board.
        assert bob.get(f"/api/boards/{board_id}").status_code == 200
        assert any(b["id"] == board_id for b in bob.get("/api/boards").json()["boards"])
        board = bob.get(f"/api/boards/{board_id}").json()["board"]
        assert bob.put(f"/api/boards/{board_id}", json=board).status_code == 200


def test_non_owner_cannot_manage_members_or_delete() -> None:
    with TestClient(app) as alice, TestClient(app) as bob:
        register(alice, "alice")
        register(bob, "bob")
        board_id = first_board_id(alice)
        alice.post(f"/api/boards/{board_id}/members", json={"username": "bob"})

        assert bob.post(
            f"/api/boards/{board_id}/members", json={"username": "alice"}
        ).status_code == 403
        assert bob.delete(f"/api/boards/{board_id}").status_code == 403


def test_share_unknown_user_returns_404() -> None:
    with TestClient(app) as client:
        register(client, "alice")
        board_id = first_board_id(client)
        response = client.post(
            f"/api/boards/{board_id}/members", json={"username": "ghost"}
        )
    assert response.status_code == 404


def test_owner_can_remove_member() -> None:
    with TestClient(app) as alice, TestClient(app) as bob:
        register(alice, "alice")
        register(bob, "bob")
        board_id = first_board_id(alice)
        alice.post(f"/api/boards/{board_id}/members", json={"username": "bob"})

        removed = alice.delete(f"/api/boards/{board_id}/members/bob")
        assert removed.status_code == 200
        assert [m["username"] for m in removed.json()["members"]] == ["alice"]
        assert bob.get(f"/api/boards/{board_id}").status_code == 404


# ----- Comments -----


def test_comments_can_be_added_and_listed() -> None:
    with TestClient(app) as client:
        login(client)
        board_id = first_board_id(client)
        posted = client.post(
            f"/api/boards/{board_id}/comments",
            json={"cardId": "card-1", "body": "Looks good"},
        )
        assert posted.status_code == 200
        comments = posted.json()["comments"]
        assert len(comments) == 1
        assert comments[0]["body"] == "Looks good"
        assert comments[0]["username"] == "user"

        listed = client.get(
            f"/api/boards/{board_id}/comments", params={"cardId": "card-1"}
        )
        assert listed.status_code == 200
        assert len(listed.json()["comments"]) == 1


def test_empty_comment_rejected() -> None:
    with TestClient(app) as client:
        login(client)
        board_id = first_board_id(client)
        response = client.post(
            f"/api/boards/{board_id}/comments",
            json={"cardId": "card-1", "body": "   "},
        )
    assert response.status_code == 422


def test_non_member_cannot_comment() -> None:
    with TestClient(app) as alice, TestClient(app) as bob:
        register(alice, "alice")
        register(bob, "bob")
        board_id = first_board_id(alice)
        response = bob.post(
            f"/api/boards/{board_id}/comments",
            json={"cardId": "card-1", "body": "intrusion"},
        )
    assert response.status_code == 404


# ----- Activity -----


def test_activity_records_key_events() -> None:
    with TestClient(app) as alice, TestClient(app) as bob:
        register(alice, "alice")
        register(bob, "bob")
        board_id = first_board_id(alice)
        alice.patch(f"/api/boards/{board_id}", json={"name": "Roadmap"})
        alice.post(f"/api/boards/{board_id}/members", json={"username": "bob"})
        alice.post(
            f"/api/boards/{board_id}/comments",
            json={"cardId": "card-1", "body": "hi"},
        )

        activity = alice.get(f"/api/boards/{board_id}/activity").json()["activity"]
    actions = {entry["action"] for entry in activity}
    assert {"created_board", "renamed_board", "added_member", "commented"} <= actions


# ----- AI -----


def test_ai_smoke_requires_authentication() -> None:
    with TestClient(app) as client:
        assert client.get("/api/ai/smoke").status_code == 401


def test_ai_smoke_reports_missing_configuration(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    with TestClient(app) as client:
        login(client)
        response = client.get("/api/ai/smoke")
    assert response.status_code == 503
    assert response.json()["detail"] == "AI is not configured"


def test_ai_smoke_returns_model_response(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")

    class FakeResponse:
        status_code = 200

        @staticmethod
        def json() -> dict[str, object]:
            return {"choices": [{"message": {"content": "4"}}]}

    monkeypatch.setattr(httpx, "post", lambda *args, **kwargs: FakeResponse())

    with TestClient(app) as client:
        login(client)
        response = client.get("/api/ai/smoke")
    assert response.status_code == 200
    assert response.json()["answer"] == "4"


def test_ai_smoke_handles_provider_network_failure(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")

    def raise_http_error(*args, **kwargs):
        raise httpx.ConnectError("network down")

    monkeypatch.setattr(httpx, "post", raise_http_error)

    with TestClient(app) as client:
        login(client)
        response = client.get("/api/ai/smoke")
    assert response.status_code == 502
    assert response.json()["detail"] == "AI provider is unavailable"


def test_ai_chat_requires_authentication() -> None:
    with TestClient(app) as client:
        response = client.post(
            "/api/ai/chat",
            json={"question": "next?", "history": [], "boardId": 1},
        )
    assert response.status_code == 401


def test_ai_chat_rejects_inaccessible_board(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    with TestClient(app) as alice, TestClient(app) as bob:
        register(alice, "alice")
        register(bob, "bob")
        alice_board = first_board_id(alice)
        response = bob.post(
            "/api/ai/chat",
            json={"question": "hi", "history": [], "boardId": alice_board},
        )
    assert response.status_code == 404


def test_ai_chat_returns_response_without_board_update(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")

    class FakeResponse:
        status_code = 200

        @staticmethod
        def json() -> dict[str, object]:
            return {
                "choices": [
                    {
                        "message": {
                            "content": json.dumps(
                                {
                                    "assistant_response": "Focus on backlog grooming.",
                                    "board_update": None,
                                }
                            )
                        }
                    }
                ]
            }

    monkeypatch.setattr(httpx, "post", lambda *args, **kwargs: FakeResponse())

    with TestClient(app) as client:
        login(client)
        board_id = first_board_id(client)
        before = client.get(f"/api/boards/{board_id}").json()
        response = client.post(
            "/api/ai/chat",
            json={"question": "What next?", "history": [], "boardId": board_id},
        )
        after = client.get(f"/api/boards/{board_id}").json()

    assert response.status_code == 200
    payload = response.json()
    assert payload["assistantResponse"] == "Focus on backlog grooming."
    assert payload["boardUpdated"] is False
    assert after["version"] == before["version"]


def test_ai_chat_applies_board_update(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")

    with TestClient(app) as client:
        login(client)
        board_id = first_board_id(client)
        current = client.get(f"/api/boards/{board_id}").json()
        next_board = current["board"]
        next_board["columns"][0]["title"] = "AI Updated Backlog"

        class FakeResponse:
            status_code = 200

            @staticmethod
            def json() -> dict[str, object]:
                return {
                    "choices": [
                        {
                            "message": {
                                "content": json.dumps(
                                    {
                                        "assistant_response": "Renamed the first column.",
                                        "board_update": next_board,
                                    }
                                )
                            }
                        }
                    ]
                }

        monkeypatch.setattr(httpx, "post", lambda *args, **kwargs: FakeResponse())

        response = client.post(
            "/api/ai/chat",
            json={"question": "rename", "history": [], "boardId": board_id},
        )
        reloaded = client.get(f"/api/boards/{board_id}").json()

    assert response.status_code == 200
    assert response.json()["boardUpdated"] is True
    assert response.json()["board"]["columns"][0]["title"] == "AI Updated Backlog"
    assert reloaded["board"]["columns"][0]["title"] == "AI Updated Backlog"


def test_ai_chat_ignores_malformed_board_update(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")

    class FakeResponse:
        status_code = 200

        @staticmethod
        def json() -> dict[str, object]:
            return {
                "choices": [
                    {
                        "message": {
                            "content": json.dumps(
                                {
                                    "assistant_response": "Here is some advice.",
                                    "board_update": {"columns": ["Backlog"], "cards": {}},
                                }
                            )
                        }
                    }
                ]
            }

    monkeypatch.setattr(httpx, "post", lambda *args, **kwargs: FakeResponse())

    with TestClient(app) as client:
        login(client)
        board_id = first_board_id(client)
        before = client.get(f"/api/boards/{board_id}").json()
        response = client.post(
            "/api/ai/chat",
            json={"question": "advice", "history": [], "boardId": board_id},
        )
        after = client.get(f"/api/boards/{board_id}").json()

    assert response.status_code == 200
    assert response.json()["boardUpdated"] is False
    assert after["version"] == before["version"]


def test_ai_chat_provider_error_returns_error(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")

    class FakeResponse:
        status_code = 402
        text = '{"error": "insufficient credits"}'

        @staticmethod
        def json() -> dict[str, object]:
            return {"error": "insufficient credits"}

    monkeypatch.setattr(httpx, "post", lambda *args, **kwargs: FakeResponse())

    with TestClient(app) as client:
        login(client)
        board_id = first_board_id(client)
        response = client.post(
            "/api/ai/chat",
            json={"question": "plan", "history": [], "boardId": board_id},
        )
    assert response.status_code == 502
    assert response.json()["detail"] == "AI provider returned an error"
