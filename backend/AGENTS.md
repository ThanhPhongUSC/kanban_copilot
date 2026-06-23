# Backend Agent Guide

## Purpose

The backend directory contains the FastAPI service that will:

- Serve static site assets at `/`
- Expose API routes under `/api/*`
- Manage auth/session and persistence for the MVP
- Integrate with OpenRouter for AI features in later phases

## Module Layout

The service is split into focused top-level modules (imported via `--app-dir`/`conftest.py`):

- `main.py`: FastAPI app, lifespan DB init, routes, and static serving.
- `config.py`: paths, constants, env-derived settings, logger.
- `models.py`: Pydantic request/response models.
- `database.py`: SQLite connection, schema migration (`PRAGMA user_version`), `DEFAULT_BOARD`, and all user/board/member/comment/activity read/write helpers (each takes an open `sqlite3.Connection`).
- `auth.py`: pbkdf2 password hashing (`hash_password`/`verify_password`), signed session-token helpers, and the `get_current_username` dependency.
- `ai.py`: OpenRouter client, structured-chat call, and `merge_ai_board_update`.

## Current Status

- Routes (all in `main.py`):
	- `/api/health`
	- `/api/auth/register` (POST) — self-registration; creates the user, a default board, and a session.
	- `/api/auth/login`, `/api/auth/logout`, `/api/auth/session`
	- `/api/boards` (GET list, POST create)
	- `/api/boards/{id}` (GET, PUT save state, PATCH rename, DELETE — owner only)
	- `/api/boards/{id}/members` (GET, POST add — owner only), `/api/boards/{id}/members/{username}` (DELETE — owner only)
	- `/api/boards/{id}/comments` (GET by `cardId`, POST add)
	- `/api/boards/{id}/activity` (GET)
	- `/api/ai/smoke` (GET), `/api/ai/chat` (POST, takes `boardId`)
	- static frontend serving at `/`
- Auth uses a backend-managed HTTP-only cookie (`pm_session`). Passwords are stored as pbkdf2-sha256 hashes with a per-user salt.
- Multiple users; self-registration is open. The demo account `user` / `password` is seeded with a populated `My Board`.
- Each board has an owner and zero or more `editor` members (`board_members`). `_require_access` in `main.py` resolves a board the caller owns or is a member of (404 when not visible, 403 for owner-only actions).
- Board state is stored as a JSON blob per board plus an integer `version`. Cards carry optional `priority`, `dueDate`, `labels`, and `assignee` fields (backward compatible).
- Comments (`card_comments`) and an activity log (`activity`) are relational tables scoped to a board.
- `init_db()` checks `PRAGMA user_version` and migrates a legacy single-board database (old `boards.user_id UNIQUE`, password-less users) forward to v1 in place.
- AI chat operates on the board named by `boardId`, validating/persisting any `board_update`. Requires `OPENROUTER_API_KEY`.
- In Docker runtime, `backend/static` is populated from the exported Next.js build.

## Session and Configuration

- The session cookie holds a signed token (`username:HMAC-SHA256`), not the raw username, so it cannot be forged without the server secret.
- `PM_SESSION_SECRET` sets the signing secret; if unset, a random secret is generated per process (sessions reset on restart).
- `PM_COOKIE_SECURE=true` sets the `Secure` flag on the cookie (default `false` for local HTTP).
- `init_db()` runs once via the app lifespan on startup; request handlers do not re-run it.

## Known Limitations (MVP scope)

- CSRF protection relies on `SameSite=Lax` only; no per-request CSRF token. Add one before any non-local deployment.
- Optimistic concurrency is not enforced: `PUT /api/board` overwrites and `POST /api/ai/chat` does a read-modify-write, so a manual edit made while an AI call is in flight can be clobbered. The `version` field exists to support an `If-Match` check later if needed.

## Working Rules

- Keep API routes grouped under `/api/*`.
- Keep behavior simple and explicit.
- Add tests with each behavior change.
- Preserve MVP scope and avoid adding features early.