# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Project Management MVP: a single-user Kanban board with an AI sidebar chat ("Board Copilot") that can create/edit/move cards. NextJS frontend, FastAPI backend serving the static frontend at `/`, SQLite persistence, OpenRouter for AI. Everything ships as one Docker container running on port 8000.

The project is built phase-by-phase (see `docs/PLAN.md` and `docs/PHASE*.md`). Each phase is approval-gated; preserve MVP scope and do not add features ahead of the active phase.

## Architecture

The runtime is a single FastAPI process. `backend/main.py` (one file, ~650 lines) holds everything: Pydantic models, SQLite access, the OpenRouter client, all `/api/*` routes, and static serving of the built frontend from `backend/static`.

- **Static serving**: In Docker, the Next.js static export (`frontend/out`) is copied into `backend/static` and served at `/`. There is no separate frontend server in the MVP run path.
- **Auth**: Backend-managed HTTP-only cookie `pm_session`. Credentials are hardcoded to `user` / `password`. Board APIs depend on `get_current_username` (reads the cookie) and reject unauthenticated requests.
- **Persistence**: SQLite at `backend/data/pm.db`, auto-created if missing (override path with env `PM_DB_PATH`). Users and boards are separate tables; board state is stored as a JSON blob plus an integer `version` field. Schema supports multiple users for the future, but the MVP uses one board per user.
- **AI flow**: `POST /api/ai/chat` sends board JSON + user question + conversation history to OpenRouter model `openai/gpt-oss-120b:free`. The model must return structured JSON (assistant text + optional `board_update`). `merge_ai_board_update` validates and merges any proposed board change before it is persisted — invalid AI output must never corrupt board state. Requires `OPENROUTER_API_KEY` in the environment (read from root `.env` via `--env-file`).

Frontend ownership is unusual: **`src/components/AuthGate.tsx` is the stateful hub** — it owns the session gate, board load/save against the API, and AI chat state + board refresh. `KanbanBoard.tsx` handles board rendering and dnd-kit drag/drop orchestration; `AIChatSidebar.tsx` is the chat thread UI. `src/lib/kanban.ts` holds board types, initial data, ID creation, and the `moveCard` logic. The frontend assumes the backend board contract `{ status, board, version }`.

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
