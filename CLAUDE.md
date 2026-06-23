# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A multi-user Project Management app: user accounts (self-registration), multiple Kanban boards per user, board sharing between users, rich cards (priority, due date, labels, assignee), per-card comments, a board activity feed, and an AI sidebar chat ("Board Copilot") that can create/edit/move cards on the active board. NextJS frontend, FastAPI backend serving the static frontend at `/`, SQLite persistence, OpenRouter for AI. Everything ships as one Docker container running on port 8000.

It started as a phase-by-phase MVP (see `docs/PLAN.md` and `docs/PHASE*.md`); the multi-user expansion is documented in `docs/PHASE11.md`. Keep changes simple, add tests with every behavior change, and maintain the coverage/integration-test gates.

## Architecture

The runtime is a single FastAPI process, split into focused modules under `backend/`:

- `main.py` — FastAPI app, lifespan (one-time DB init/migration), all `/api/*` routes, the `_require_access` board-authorization helper, and static serving of the built frontend from `backend/static`.
- `config.py` — paths, constants, and env-derived settings (`OPENROUTER_*`, session/cookie config, demo credentials).
- `models.py` — Pydantic request/response models (including the extended `Card`).
- `database.py` — SQLite connection, schema migration, `DEFAULT_BOARD`, and the user/board/member/comment/activity read/write helpers (each takes an open `sqlite3.Connection`; routes own the connection so access-check + write share one transaction).
- `auth.py` — pbkdf2 password hashing (`hash_password`/`verify_password`), signed session-token helpers, and the `get_current_username` dependency.
- `ai.py` — OpenRouter client, structured-chat call, and `merge_ai_board_update`.

`conftest.py` and Docker's `--app-dir /app/backend` both put `backend/` on `sys.path`, so these are imported as top-level modules (`import config`, `from main import app`).

- **Static serving**: In Docker, the Next.js static export (`frontend/out`) is copied into `backend/static` and served at `/`. There is no separate frontend server in the run path.
- **Auth**: Backend-managed HTTP-only cookie `pm_session` (signed `username:HMAC`). Self-registration is open via `POST /api/auth/register`; passwords are stored as pbkdf2-sha256 hashes with a per-user salt. The demo account `user` / `password` is seeded. Board APIs depend on `get_current_username` and then `_require_access`, which resolves a board the caller owns or is a member of (404 when not visible, 403 for owner-only actions).
- **Persistence**: SQLite at `backend/data/pm.db`, auto-created if missing (override path with env `PM_DB_PATH`). Tables: `users`, `boards` (owner + JSON state + `version`), `board_members` (owner/editor), `card_comments`, `activity`. `init_db()` uses `PRAGMA user_version` to migrate a legacy single-board database forward in place. Each board's columns/cards are a JSON blob; cards carry optional `priority`/`dueDate`/`labels`/`assignee` (backward compatible).
- **AI flow**: `POST /api/ai/chat` takes a `boardId`, then sends that board's JSON + user question + conversation history to OpenRouter model `openai/gpt-oss-120b:free`. The model must return structured JSON (assistant text + optional `board_update`). `merge_ai_board_update` validates and merges any proposed board change before it is persisted — invalid AI output must never corrupt board state. Requires `OPENROUTER_API_KEY` in the environment (read from root `.env` via `--env-file`).

Frontend: **`src/components/AuthGate.tsx` is a thin session gate** that renders `AuthScreen` (login/register) or `Workspace`. **`Workspace.tsx` is the stateful hub** — it owns the board list + selected board, per-board load/save, members, activity, AI chat state, and the card editor. `KanbanBoard.tsx` handles board rendering, filtering, and dnd-kit drag/drop; `RightPanel.tsx` is the tabbed sidebar (Copilot/Members/Activity); `CardEditor.tsx` edits card metadata + comments. **All network calls go through the typed client in `src/lib/api.ts`** (throws `ApiError`); `src/lib/kanban.ts` holds board/card types, filtering helpers, ID creation, and `moveCard`. The per-board contract is `{ status, boardId, name, role, board, version, members }`.

## Commands

Run the full app (builds image, runs container on http://localhost:8000):
```
scripts/start-mac.sh      # or start-linux.sh / start-windows.ps1
scripts/stop-mac.sh       # stop + remove container
```

Backend (from `backend/`, uses `uv`):
```
uv run uvicorn main:app --reload    # dev server
uv run pytest                       # all backend tests
uv run pytest tests/test_app.py::test_name   # single test
```

Frontend (from `frontend/`):
```
npm run dev          # local dev server
npm run build        # production/static build
npm run lint         # eslint
npm run test:unit    # vitest (unit/component)
npm run test:e2e     # playwright e2e
npm run test:all     # unit then e2e
```
Run a single unit test: `npx vitest run src/components/AuthGate.test.tsx` (add `-t "name"` to filter).

**E2E tests run against the real Docker container**, not a dev server: `playwright.config.ts` launches `tests/container-webserver.mjs`, which runs the platform start/stop scripts and deletes `backend/data/pm.db*` first for a deterministic DB. Docker must be running and the build takes time (240s webserver timeout).

## Conventions

- Per the root `AGENTS.md`: keep it simple, never over-engineer, no unnecessary defensive programming, no extra features. Find the root cause before fixing — prove with evidence, don't guess. No emojis, ever.
- Add tests with every behavior change. Backend: pytest with mocked OpenRouter (no live calls in tests). Frontend: target 80%+ unit coverage for new/changed code; e2e mocks the AI board-update path.
- Keep all API routes grouped under `/api/*`.
- Each directory has its own `AGENTS.md` (root, `backend/`, `frontend/`, `scripts/`) with directory-specific detail — consult them.
- Brand palette: yellow `#ecad0a`, blue `#209dd7`, purple `#753991`, navy `#032147`, gray `#888888` (defined in `frontend/src/app/globals.css`).
