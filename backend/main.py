import json
import os
import sqlite3
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

import httpx
from fastapi import Cookie, Depends, FastAPI, HTTPException, Response
from pydantic import BaseModel
from fastapi.staticfiles import StaticFiles


BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
DEFAULT_DB_PATH = BASE_DIR / "data" / "pm.db"
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
OPENROUTER_MODEL = "openai/gpt-oss-120b"
SESSION_COOKIE_NAME = "pm_session"
DEMO_USERNAME = "user"
DEMO_PASSWORD = "password"


@asynccontextmanager
async def app_lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(title="PM MVP Backend", lifespan=app_lifespan)


class LoginRequest(BaseModel):
    username: str
    password: str


class Card(BaseModel):
    id: str
    title: str
    details: str


class Column(BaseModel):
    id: str
    title: str
    cardIds: list[str]


class BoardData(BaseModel):
    columns: list[Column]
    cards: dict[str, Card]


class BoardResponse(BaseModel):
    status: str
    board: BoardData
    version: int


class AISmokeResponse(BaseModel):
    status: str
    model: str
    prompt: str
    answer: str


DEFAULT_BOARD: dict[str, Any] = {
    "columns": [
        {"id": "col-backlog", "title": "Backlog", "cardIds": ["card-1", "card-2"]},
        {"id": "col-discovery", "title": "Discovery", "cardIds": ["card-3"]},
        {
            "id": "col-progress",
            "title": "In Progress",
            "cardIds": ["card-4", "card-5"],
        },
        {"id": "col-review", "title": "Review", "cardIds": ["card-6"]},
        {"id": "col-done", "title": "Done", "cardIds": ["card-7", "card-8"]},
    ],
    "cards": {
        "card-1": {
            "id": "card-1",
            "title": "Align roadmap themes",
            "details": "Draft quarterly themes with impact statements and metrics.",
        },
        "card-2": {
            "id": "card-2",
            "title": "Gather customer signals",
            "details": "Review support tags, sales notes, and churn feedback.",
        },
        "card-3": {
            "id": "card-3",
            "title": "Prototype analytics view",
            "details": "Sketch initial dashboard layout and key drill-downs.",
        },
        "card-4": {
            "id": "card-4",
            "title": "Refine status language",
            "details": "Standardize column labels and tone across the board.",
        },
        "card-5": {
            "id": "card-5",
            "title": "Design card layout",
            "details": "Add hierarchy and spacing for scanning dense lists.",
        },
        "card-6": {
            "id": "card-6",
            "title": "QA micro-interactions",
            "details": "Verify hover, focus, and loading states.",
        },
        "card-7": {
            "id": "card-7",
            "title": "Ship marketing page",
            "details": "Final copy approved and asset pack delivered.",
        },
        "card-8": {
            "id": "card-8",
            "title": "Close onboarding sprint",
            "details": "Document release notes and share internally.",
        },
    },
}


def get_db_path() -> Path:
    raw_path = os.getenv("PM_DB_PATH")
    return Path(raw_path) if raw_path else DEFAULT_DB_PATH


def open_connection() -> sqlite3.Connection:
    db_path = get_db_path()
    db_path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(db_path)
    connection.row_factory = sqlite3.Row
    return connection


def init_db() -> None:
    with open_connection() as connection:
        connection.execute("PRAGMA foreign_keys = ON")
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              username TEXT NOT NULL UNIQUE,
              created_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS boards (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER NOT NULL UNIQUE,
              name TEXT NOT NULL DEFAULT 'My Board',
              board_json TEXT NOT NULL,
              version INTEGER NOT NULL DEFAULT 1,
              created_at TEXT NOT NULL DEFAULT (datetime('now')),
              updated_at TEXT NOT NULL DEFAULT (datetime('now')),
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
            """
        )
        connection.execute(
            "CREATE INDEX IF NOT EXISTS idx_boards_user_id ON boards(user_id)"
        )

        user_id = ensure_user(connection, DEMO_USERNAME)
        connection.execute(
            """
            INSERT OR IGNORE INTO boards (user_id, board_json)
            VALUES (?, ?)
            """,
            (user_id, json.dumps(DEFAULT_BOARD)),
        )


def ensure_user(connection: sqlite3.Connection, username: str) -> int:
    existing_user = connection.execute(
        "SELECT id FROM users WHERE username = ?",
        (username,),
    ).fetchone()
    if existing_user:
        return int(existing_user["id"])

    cursor = connection.execute(
        "INSERT INTO users (username) VALUES (?)",
        (username,),
    )
    return int(cursor.lastrowid)


def get_user_id(connection: sqlite3.Connection, username: str) -> int | None:
    row = connection.execute(
        "SELECT id FROM users WHERE username = ?",
        (username,),
    ).fetchone()
    return int(row["id"]) if row else None


def get_board_for_user(username: str) -> tuple[dict[str, Any], int]:
    init_db()
    with open_connection() as connection:
        user_id = ensure_user(connection, username)
        row = connection.execute(
            "SELECT board_json, version FROM boards WHERE user_id = ?",
            (user_id,),
        ).fetchone()

        if not row:
            connection.execute(
                "INSERT INTO boards (user_id, board_json) VALUES (?, ?)",
                (user_id, json.dumps(DEFAULT_BOARD)),
            )
            return DEFAULT_BOARD, 1

        return json.loads(str(row["board_json"])), int(row["version"])


def save_board_for_user(username: str, board: BoardData) -> tuple[dict[str, Any], int]:
    init_db()
    board_payload = board.model_dump(mode="json")
    with open_connection() as connection:
        user_id = ensure_user(connection, username)
        current = connection.execute(
            "SELECT version FROM boards WHERE user_id = ?",
            (user_id,),
        ).fetchone()
        next_version = (int(current["version"]) + 1) if current else 1

        if current:
            connection.execute(
                """
                UPDATE boards
                SET board_json = ?, version = ?, updated_at = datetime('now')
                WHERE user_id = ?
                """,
                (json.dumps(board_payload), next_version, user_id),
            )
        else:
            connection.execute(
                "INSERT INTO boards (user_id, board_json, version) VALUES (?, ?, ?)",
                (user_id, json.dumps(board_payload), next_version),
            )

    return board_payload, next_version


def get_current_username(pm_session: str | None = Cookie(default=None)) -> str:
    if not pm_session:
        raise HTTPException(status_code=401, detail="Not authenticated")

    init_db()
    with open_connection() as connection:
        user_id = get_user_id(connection, pm_session)

    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return pm_session


def call_openrouter_smoke(prompt: str) -> str:
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="AI is not configured")

    payload = {
        "model": OPENROUTER_MODEL,
        "messages": [
            {
                "role": "system",
                "content": "Answer the user prompt concisely.",
            },
            {"role": "user", "content": prompt},
        ],
        "temperature": 0,
    }

    try:
        response = httpx.post(
            OPENROUTER_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=30.0,
        )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="AI provider is unavailable") from exc

    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail="AI provider returned an error")

    data = response.json()
    choices = data.get("choices")
    if not isinstance(choices, list) or not choices:
        raise HTTPException(status_code=502, detail="AI provider response was invalid")

    message = choices[0].get("message", {})
    content = message.get("content")
    if not isinstance(content, str) or not content.strip():
        raise HTTPException(status_code=502, detail="AI provider response was invalid")
    return content.strip()


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "pm-mvp-backend"}


@app.post("/api/auth/login")
def login(payload: LoginRequest, response: Response) -> dict[str, str]:
    if payload.username != DEMO_USERNAME or payload.password != DEMO_PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    init_db()
    with open_connection() as connection:
        ensure_user(connection, payload.username)

    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=payload.username,
        httponly=True,
        samesite="lax",
        secure=False,
        path="/",
    )
    return {"status": "ok", "user": DEMO_USERNAME}


@app.post("/api/auth/logout")
def logout(response: Response) -> dict[str, str]:
    response.delete_cookie(key=SESSION_COOKIE_NAME, path="/")
    return {"status": "ok"}


@app.get("/api/auth/session")
def session(pm_session: str | None = Cookie(default=None)) -> dict[str, str]:
    if not pm_session:
        raise HTTPException(status_code=401, detail="Not authenticated")

    init_db()
    with open_connection() as connection:
        user_id = get_user_id(connection, pm_session)
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")

    return {"status": "ok", "user": pm_session}


@app.get("/api/board", response_model=BoardResponse)
def get_board(username: str = Depends(get_current_username)) -> BoardResponse:
    board_payload, version = get_board_for_user(username)
    return BoardResponse(status="ok", board=BoardData.model_validate(board_payload), version=version)


@app.put("/api/board", response_model=BoardResponse)
def update_board(board: BoardData, username: str = Depends(get_current_username)) -> BoardResponse:
    saved_payload, version = save_board_for_user(username, board)
    return BoardResponse(status="ok", board=BoardData.model_validate(saved_payload), version=version)


@app.get("/api/ai/smoke", response_model=AISmokeResponse)
def ai_smoke(_: str = Depends(get_current_username)) -> AISmokeResponse:
    prompt = "What is 2+2? Reply with only the final number."
    answer = call_openrouter_smoke(prompt)
    return AISmokeResponse(
        status="ok",
        model=OPENROUTER_MODEL,
        prompt=prompt,
        answer=answer,
    )


app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="frontend")
