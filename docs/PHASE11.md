# Phase 11: Multi-User Project Management Expansion

This phase grows the single-user MVP into a comprehensive, multi-user project
management application while preserving the existing run path (one Docker
container, FastAPI serving the static Next.js build, SQLite, OpenRouter AI).

## Scope delivered

- **User management**: open self-registration (`POST /api/auth/register`),
  pbkdf2-sha256 password hashing with a per-user salt, multiple users, and
  per-user data isolation. The demo `user` / `password` account is still seeded.
- **Multiple boards per user**: full board CRUD and listing; a board switcher in
  the UI; the singular `/api/board` endpoints are replaced by `/api/boards` and
  `/api/boards/{id}`.
- **Rich cards + filtering**: cards gain optional `priority`, `dueDate`,
  `labels`, and `assignee`; a card editor modal; and a filter bar (text,
  priority, label, assignee).
- **Board sharing**: `board_members` table with `owner`/`editor` roles; owners
  invite/remove members by username; access is enforced by `_require_access`.
- **Activity & comments**: per-card comments and a board activity feed (board
  created/renamed, members added/removed, comments, AI updates).
- **AI**: capability unchanged; `POST /api/ai/chat` now targets the active board
  via a `boardId` field.

## Data model (schema v1)

- `users(id, username UNIQUE, password_hash, password_salt, created_at)`
- `boards(id, owner_id, name, board_json, version, created_at, updated_at)`
- `board_members(board_id, user_id, role, PRIMARY KEY(board_id, user_id))`
- `card_comments(id, board_id, card_id, user_id, body, created_at)`
- `activity(id, board_id, user_id, action, detail, created_at)`

`init_db()` checks `PRAGMA user_version` and migrates a legacy single-board
database (old `boards.user_id UNIQUE`, password-less users) forward in place,
then stamps `user_version = 1`.

## Architecture decisions

- Board columns/cards stay a JSON blob per board (preserving the AI merge logic
  and the frontend board contract); only inherently relational data (credentials,
  membership, comments, activity) became tables.
- Passwords use the standard library (`hashlib.pbkdf2_hmac`) — no new runtime
  dependency.
- `database.py` helpers take an open connection; routes own the connection so an
  access check and the subsequent write share one transaction.
- Frontend network access is centralized in `src/lib/api.ts`; `AuthGate` is a thin
  gate and `Workspace` is the authenticated hub.

## Tests

- Backend (`backend/tests/test_app.py`): migration, register/login, board CRUD,
  user isolation, sharing authorization, comments, activity, rich-card round-trip,
  and AI-chat-with-`boardId`. All OpenRouter calls mocked.
- Frontend unit/component (Vitest): API client, filtering helpers, and every new
  component, plus a `Workspace` integration test over a stateful fake backend.
  Project statement coverage ~91%.
- E2E (`frontend/tests/kanban.spec.ts`, real Docker container): registration,
  multi-board create/switch, card-metadata persistence, plus the existing flows.

## Out of scope (future)

Real-time collaboration/websockets, email/password-reset, finer-grained roles
beyond owner/editor, and a full cross-board analytics dashboard.
