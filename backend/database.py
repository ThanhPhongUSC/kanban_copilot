import json
import os
import sqlite3
from pathlib import Path
from typing import Any

from config import DEFAULT_DB_PATH, DEMO_PASSWORD, DEMO_USERNAME
from models import BoardData


SCHEMA_VERSION = 1


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


def new_board_payload() -> dict[str, Any]:
    return {
        "columns": [
            {"id": "col-todo", "title": "To Do", "cardIds": []},
            {"id": "col-progress", "title": "In Progress", "cardIds": []},
            {"id": "col-done", "title": "Done", "cardIds": []},
        ],
        "cards": {},
    }


def get_db_path() -> Path:
    raw_path = os.getenv("PM_DB_PATH")
    return Path(raw_path) if raw_path else DEFAULT_DB_PATH


def open_connection() -> sqlite3.Connection:
    db_path = get_db_path()
    db_path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(db_path)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def _table_exists(connection: sqlite3.Connection, name: str) -> bool:
    return (
        connection.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name = ?",
            (name,),
        ).fetchone()
        is not None
    )


def _column_names(connection: sqlite3.Connection, table: str) -> set[str]:
    return {row[1] for row in connection.execute(f"PRAGMA table_info({table})")}


def _create_users_table(connection: sqlite3.Connection) -> None:
    connection.execute(
        """
        CREATE TABLE users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL DEFAULT '',
          password_salt TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
        """
    )


def _create_boards_table(connection: sqlite3.Connection) -> None:
    connection.execute(
        """
        CREATE TABLE boards (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          owner_id INTEGER NOT NULL,
          name TEXT NOT NULL DEFAULT 'My Board',
          board_json TEXT NOT NULL,
          version INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
        )
        """
    )
    connection.execute(
        "CREATE INDEX IF NOT EXISTS idx_boards_owner ON boards(owner_id)"
    )


def _create_relational_tables(connection: sqlite3.Connection) -> None:
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS board_members (
          board_id INTEGER NOT NULL,
          user_id INTEGER NOT NULL,
          role TEXT NOT NULL DEFAULT 'editor',
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          PRIMARY KEY (board_id, user_id),
          FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
        """
    )
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS card_comments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          board_id INTEGER NOT NULL,
          card_id TEXT NOT NULL,
          user_id INTEGER NOT NULL,
          body TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
        """
    )
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS activity (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          board_id INTEGER NOT NULL,
          user_id INTEGER NOT NULL,
          action TEXT NOT NULL,
          detail TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
        """
    )
    connection.execute(
        "CREATE INDEX IF NOT EXISTS idx_activity_board ON activity(board_id)"
    )
    connection.execute(
        "CREATE INDEX IF NOT EXISTS idx_comments_board_card "
        "ON card_comments(board_id, card_id)"
    )


def _migrate_to_v1(connection: sqlite3.Connection) -> None:
    """Bring a fresh or legacy (single-board) database up to schema v1."""
    if not _table_exists(connection, "users"):
        _create_users_table(connection)
    else:
        user_columns = _column_names(connection, "users")
        if "password_hash" not in user_columns:
            connection.execute(
                "ALTER TABLE users ADD COLUMN password_hash TEXT NOT NULL DEFAULT ''"
            )
        if "password_salt" not in user_columns:
            connection.execute(
                "ALTER TABLE users ADD COLUMN password_salt TEXT NOT NULL DEFAULT ''"
            )

    if not _table_exists(connection, "boards"):
        _create_boards_table(connection)
    elif "owner_id" not in _column_names(connection, "boards"):
        # Legacy schema stored the owner in `user_id` with a UNIQUE constraint.
        connection.execute("ALTER TABLE boards RENAME TO boards_old")
        _create_boards_table(connection)
        connection.execute(
            """
            INSERT INTO boards (id, owner_id, name, board_json, version, created_at, updated_at)
            SELECT id, user_id, name, board_json, version, created_at, updated_at
            FROM boards_old
            """
        )
        connection.execute("DROP TABLE boards_old")

    _create_relational_tables(connection)

    # Every existing board needs an owner membership row.
    connection.execute(
        """
        INSERT OR IGNORE INTO board_members (board_id, user_id, role)
        SELECT id, owner_id, 'owner' FROM boards
        """
    )


def init_db() -> None:
    with open_connection() as connection:
        version = int(connection.execute("PRAGMA user_version").fetchone()[0])
        if version < SCHEMA_VERSION:
            _migrate_to_v1(connection)
            connection.execute(f"PRAGMA user_version = {SCHEMA_VERSION}")
        _seed_demo_user(connection)


def _seed_demo_user(connection: sqlite3.Connection) -> None:
    from auth import hash_password

    row = connection.execute(
        "SELECT id, password_hash FROM users WHERE username = ?",
        (DEMO_USERNAME,),
    ).fetchone()

    if row is None:
        digest, salt = hash_password(DEMO_PASSWORD)
        cursor = connection.execute(
            "INSERT INTO users (username, password_hash, password_salt) VALUES (?, ?, ?)",
            (DEMO_USERNAME, digest, salt),
        )
        user_id = int(cursor.lastrowid)
    else:
        user_id = int(row["id"])
        if not row["password_hash"]:
            digest, salt = hash_password(DEMO_PASSWORD)
            connection.execute(
                "UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?",
                (digest, salt, user_id),
            )

    has_board = connection.execute(
        "SELECT 1 FROM boards WHERE owner_id = ? LIMIT 1",
        (user_id,),
    ).fetchone()
    if not has_board:
        cursor = connection.execute(
            "INSERT INTO boards (owner_id, name, board_json) VALUES (?, ?, ?)",
            (user_id, "My Board", json.dumps(DEFAULT_BOARD)),
        )
        board_id = int(cursor.lastrowid)
        connection.execute(
            "INSERT OR IGNORE INTO board_members (board_id, user_id, role) "
            "VALUES (?, ?, 'owner')",
            (board_id, user_id),
        )


# ----- Users -----


def get_user_id(connection: sqlite3.Connection, username: str) -> int | None:
    row = connection.execute(
        "SELECT id FROM users WHERE username = ?",
        (username,),
    ).fetchone()
    return int(row["id"]) if row else None


def get_username(connection: sqlite3.Connection, user_id: int) -> str | None:
    row = connection.execute(
        "SELECT username FROM users WHERE id = ?",
        (user_id,),
    ).fetchone()
    return str(row["username"]) if row else None


def get_user_credentials(
    connection: sqlite3.Connection, username: str
) -> sqlite3.Row | None:
    return connection.execute(
        "SELECT id, password_hash, password_salt FROM users WHERE username = ?",
        (username,),
    ).fetchone()


def create_user(connection: sqlite3.Connection, username: str, password: str) -> int:
    from auth import hash_password

    digest, salt = hash_password(password)
    cursor = connection.execute(
        "INSERT INTO users (username, password_hash, password_salt) VALUES (?, ?, ?)",
        (username, digest, salt),
    )
    return int(cursor.lastrowid)


# ----- Board access -----


def get_role(connection: sqlite3.Connection, board_id: int, user_id: int) -> str | None:
    row = connection.execute(
        "SELECT role FROM board_members WHERE board_id = ? AND user_id = ?",
        (board_id, user_id),
    ).fetchone()
    return str(row["role"]) if row else None


# ----- Boards -----


def list_boards_for_user(
    connection: sqlite3.Connection, user_id: int
) -> list[dict[str, Any]]:
    rows = connection.execute(
        """
        SELECT b.id, b.name, b.board_json, b.updated_at, m.role
        FROM boards b
        JOIN board_members m ON m.board_id = b.id
        WHERE m.user_id = ?
        ORDER BY b.created_at ASC, b.id ASC
        """,
        (user_id,),
    ).fetchall()

    summaries: list[dict[str, Any]] = []
    for row in rows:
        board = json.loads(str(row["board_json"]))
        summaries.append(
            {
                "id": int(row["id"]),
                "name": str(row["name"]),
                "role": str(row["role"]),
                "columnCount": len(board.get("columns", [])),
                "cardCount": len(board.get("cards", {})),
                "updatedAt": str(row["updated_at"]),
            }
        )
    return summaries


def create_board(connection: sqlite3.Connection, user_id: int, name: str) -> int:
    cursor = connection.execute(
        "INSERT INTO boards (owner_id, name, board_json) VALUES (?, ?, ?)",
        (user_id, name, json.dumps(new_board_payload())),
    )
    board_id = int(cursor.lastrowid)
    connection.execute(
        "INSERT INTO board_members (board_id, user_id, role) VALUES (?, ?, 'owner')",
        (board_id, user_id),
    )
    return board_id


def get_board_record(
    connection: sqlite3.Connection, board_id: int
) -> dict[str, Any] | None:
    row = connection.execute(
        "SELECT id, owner_id, name, board_json, version FROM boards WHERE id = ?",
        (board_id,),
    ).fetchone()
    if not row:
        return None
    return {
        "id": int(row["id"]),
        "owner_id": int(row["owner_id"]),
        "name": str(row["name"]),
        "board": json.loads(str(row["board_json"])),
        "version": int(row["version"]),
    }


def save_board(
    connection: sqlite3.Connection, board_id: int, board: BoardData
) -> tuple[dict[str, Any], int]:
    board_payload = board.model_dump(mode="json")
    current = connection.execute(
        "SELECT version FROM boards WHERE id = ?",
        (board_id,),
    ).fetchone()
    next_version = (int(current["version"]) + 1) if current else 1
    connection.execute(
        """
        UPDATE boards
        SET board_json = ?, version = ?, updated_at = datetime('now')
        WHERE id = ?
        """,
        (json.dumps(board_payload), next_version, board_id),
    )
    return board_payload, next_version


def rename_board(connection: sqlite3.Connection, board_id: int, name: str) -> None:
    connection.execute(
        "UPDATE boards SET name = ?, updated_at = datetime('now') WHERE id = ?",
        (name, board_id),
    )


def delete_board(connection: sqlite3.Connection, board_id: int) -> None:
    connection.execute("DELETE FROM boards WHERE id = ?", (board_id,))


# ----- Members -----


def list_members(
    connection: sqlite3.Connection, board_id: int
) -> list[dict[str, str]]:
    rows = connection.execute(
        """
        SELECT u.username, m.role
        FROM board_members m
        JOIN users u ON u.id = m.user_id
        WHERE m.board_id = ?
        ORDER BY (m.role = 'owner') DESC, u.username ASC
        """,
        (board_id,),
    ).fetchall()
    return [{"username": str(r["username"]), "role": str(r["role"])} for r in rows]


def add_member(
    connection: sqlite3.Connection, board_id: int, user_id: int, role: str
) -> None:
    connection.execute(
        """
        INSERT INTO board_members (board_id, user_id, role)
        VALUES (?, ?, ?)
        ON CONFLICT(board_id, user_id) DO UPDATE SET role = excluded.role
        """,
        (board_id, user_id, role),
    )


def remove_member(
    connection: sqlite3.Connection, board_id: int, user_id: int
) -> None:
    connection.execute(
        "DELETE FROM board_members WHERE board_id = ? AND user_id = ? AND role != 'owner'",
        (board_id, user_id),
    )


# ----- Comments -----


def list_comments(
    connection: sqlite3.Connection, board_id: int, card_id: str
) -> list[dict[str, Any]]:
    rows = connection.execute(
        """
        SELECT c.id, c.card_id, u.username, c.body, c.created_at
        FROM card_comments c
        JOIN users u ON u.id = c.user_id
        WHERE c.board_id = ? AND c.card_id = ?
        ORDER BY c.created_at ASC, c.id ASC
        """,
        (board_id, card_id),
    ).fetchall()
    return [
        {
            "id": int(r["id"]),
            "cardId": str(r["card_id"]),
            "username": str(r["username"]),
            "body": str(r["body"]),
            "createdAt": str(r["created_at"]),
        }
        for r in rows
    ]


def add_comment(
    connection: sqlite3.Connection,
    board_id: int,
    card_id: str,
    user_id: int,
    body: str,
) -> int:
    cursor = connection.execute(
        "INSERT INTO card_comments (board_id, card_id, user_id, body) VALUES (?, ?, ?, ?)",
        (board_id, card_id, user_id, body),
    )
    return int(cursor.lastrowid)


# ----- Activity -----


def record_activity(
    connection: sqlite3.Connection,
    board_id: int,
    user_id: int,
    action: str,
    detail: str = "",
) -> None:
    connection.execute(
        "INSERT INTO activity (board_id, user_id, action, detail) VALUES (?, ?, ?, ?)",
        (board_id, user_id, action, detail),
    )


def list_activity(
    connection: sqlite3.Connection, board_id: int, limit: int = 50
) -> list[dict[str, Any]]:
    rows = connection.execute(
        """
        SELECT a.id, u.username, a.action, a.detail, a.created_at
        FROM activity a
        JOIN users u ON u.id = a.user_id
        WHERE a.board_id = ?
        ORDER BY a.created_at DESC, a.id DESC
        LIMIT ?
        """,
        (board_id, limit),
    ).fetchall()
    return [
        {
            "id": int(r["id"]),
            "username": str(r["username"]),
            "action": str(r["action"]),
            "detail": str(r["detail"]),
            "createdAt": str(r["created_at"]),
        }
        for r in rows
    ]
