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
- `database.py`: SQLite connection, schema bootstrap, `DEFAULT_BOARD`, user/board read/write.
- `auth.py`: signed session-token helpers and the `get_current_username` dependency.
- `ai.py`: OpenRouter client, structured-chat call, and `merge_ai_board_update`.

## Current Status

- Routes (all in `main.py`):
	- `/api/health`
	- `/api/auth/login`
	- `/api/auth/logout`
	- `/api/auth/session`
	- `/api/board` (GET)
	- `/api/board` (PUT)
	- `/api/ai/smoke` (GET)
	- `/api/ai/chat` (POST)
	- static frontend serving at `/`
- Auth uses a backend-managed HTTP-only cookie (`pm_session`).
- MVP credentials are hardcoded to `user` / `password`.
- SQLite database is auto-created if missing.
- Users and boards are persisted in SQLite.
- Board state is stored as JSON plus a version field.
- AI smoke call uses OpenRouter model `openai/gpt-oss-120b:free`.
- AI smoke requires `OPENROUTER_API_KEY` in runtime environment.
- AI chat sends board JSON, user question, and conversation history to model.
- AI chat requires structured JSON response with assistant text and optional `board_update`.
- When `board_update` is returned, backend validates and persists it.
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