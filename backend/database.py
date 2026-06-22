import json
import os
import sqlite3
from pathlib import Path
from typing import Any

from config import DEFAULT_DB_PATH, DEMO_USERNAME
from models import BoardData


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
