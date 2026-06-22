# Code Review

Date: 2026-06-22
Scope: entire repository (backend FastAPI, frontend Next.js, Docker, scripts, tests, docs)
Reviewer: Claude (Opus 4.8)

## Summary

The codebase is small, coherent, and matches its documented MVP scope. Tests are solid: 20 backend, 13 frontend unit (83.8% statements), 7 e2e, all green, with live OpenRouter calls now verified. The architecture is clean (single `backend/main.py`, `AuthGate` as the stateful frontend hub) and the AI board-merge logic is genuinely well-guarded against corruption.

The findings below are mostly about hardening and small correctness/efficiency items. None block the MVP. The one item worth a conscious decision is the session model (see SEC-1): it is fine for a local single-user demo but must not ship beyond that without change.

Severity legend: **High** = fix before any non-local use; **Medium** = should fix soon; **Low** = nice to have / cleanup.

## Remediation status (2026-06-22)

All findings addressed; full suite green (23 backend, 15 frontend unit, 7 e2e, lint 0 errors, live AI verified end to end).

- SEC-1 (High): RESOLVED in code. Session cookie now carries a signed `username:HMAC-SHA256` token verified per request (`backend/auth.py`); forged `pm_session=user` is rejected (verified live + regression test). `secure` flag is configurable via `PM_COOKIE_SECURE`. CSRF still relies on `SameSite=Lax` by design for the local MVP — documented as a remaining pre-deployment item in `backend/AGENTS.md`.
- BUG-1 (Medium): RESOLVED. Frontend sends prior turns only; the current question is no longer duplicated. Regression test added.
- PERF-1 (Medium): RESOLVED. Per-request `init_db()` calls removed; bootstrap runs once via the lifespan handler.
- DRY-1 / OBS-1 (Low): RESOLVED. Single `_post_openrouter` helper (`backend/ai.py`); upstream status/body now logged on failure.
- TEST-1 (Low): RESOLVED. Added backend provider-error, forged-cookie, and malformed-board-update tests, plus frontend chat-error and history-payload tests.
- STYLE-1 (Low): RESOLVED. Import order fixed; chat thread now auto-scrolls. Demo credentials remain pre-filled intentionally (matches the on-screen hint).
- CONC-1 (Low/Medium): DOCUMENTED, not implemented. Enforcing optimistic concurrency would over-engineer a single-user local MVP; the read-modify-write window and the unused `version` field are now documented in `backend/AGENTS.md` for when scope expands.
- Bonus: fixed 3 pre-existing `npm run lint` errors (unescaped quotes; `setState`-in-effect converted to React's derived-state-on-prop-change pattern).

### Follow-on work after the initial review

- AI-1 (High) — AI chat was fully broken (502 on every real request). RESOLVED. See the AI-1 finding below.
- REFACTOR-1 — `backend/main.py` was a ~650-line catch-all. RESOLVED. Split into `config.py`, `models.py`, `database.py`, `auth.py`, `ai.py`; `main.py` now holds only the app, lifespan, routes, and static mount. All line-number references in the findings below predate this split.

## Findings

### SEC-1 (High, but acceptable for local MVP) — Session cookie is unauthenticated identity

Location: `backend/main.py:561-569` (login), `backend/main.py:336-346` (`get_current_username`)

The session cookie stores the raw username (`pm_session=user`) and auth simply checks that the username exists in the DB. Anyone can send `Cookie: pm_session=user` and be fully authenticated without ever logging in — the password is effectively decorative for API access. `secure=False` and no CSRF token compound this.

This is consistent with the stated MVP ("local, hardcoded credentials"), so it is not a defect of the MVP as scoped. It is called out so the limitation is explicit.

Action:
- Document this explicitly as a known MVP limitation (in `backend/AGENTS.md` and/or README).
- Before any shared/hosted deployment: issue a signed, random, opaque session token (e.g. `itsdangerous` or a signed JWT) stored server-side or signed, set `secure=True`, and add CSRF protection for the cookie-authenticated POST/PUT routes.

### BUG-1 (Medium) — Current question is sent to the model twice

Location: `frontend/src/components/AuthGate.tsx:141-156`, consumed at `backend/main.py:435-512`

`handleSendChat` appends the new user message into `nextHistory` and then sends `{ question, history: nextHistory }`. The backend builds the prompt from `history` (which already contains the latest question as its last turn) and then appends `question` again. The model sees the current question duplicated, wasting tokens and slightly muddying the prompt.

Action: send the prior turns only — `history: chatMessages` (state before appending), keeping `question` as the single authoritative field. The local `setChatMessages(nextHistory)` for rendering can stay.

### PERF-1 (Medium) — `init_db()` runs on nearly every request

Location: `backend/main.py:226,246,340,557,583` (called from board read/write, auth check, session, login)

`init_db()` opens a connection and runs all `CREATE TABLE IF NOT EXISTS` / index / seed statements on each call. It already runs once at startup via the lifespan handler (`backend/main.py:25-28`), so per-request invocation is redundant DDL on every authenticated request.

Action: rely on the startup lifespan init and remove the per-request `init_db()` calls (or guard with a module-level "initialized" flag). Keep `open_connection()`'s `mkdir` so a missing data dir is still handled.

### CONC-1 (Low/Medium) — `version` field exists but optimistic concurrency is never enforced

Location: `backend/main.py:245-271` (save), `backend/main.py:616-649` (ai_chat read-modify-write)

`version` is incremented on every save but never checked. `PUT /api/board` blindly overwrites. In `ai_chat`, the board is read, the model is called (up to 45s), then the merged board is saved — any user edit made during that window is silently lost. Acceptable for a single local user; worth noting since the schema already carries `version` for exactly this purpose.

Action (optional for MVP): accept an `If-Match`/expected-version on `PUT /api/board` and reject mismatches with 409. At minimum, document that AI chat can clobber concurrent manual edits.

### DRY-1 (Low) — Duplicated OpenRouter HTTP + error handling

Location: `backend/main.py:349-391` (`call_openrouter_smoke`) and `backend/main.py:522-544` (`call_openrouter_structured_chat`)

The API-key check, `httpx.post`, network-error-to-502, and status-code-to-502 handling are copy-pasted across both callers.

Action: extract a small `post_openrouter(payload) -> dict` helper that owns auth header, timeout, network/status error mapping, and returns parsed JSON. Both callers then differ only in payload construction and response parsing.

### OBS-1 (Low) — Provider errors collapse to a generic 502, hiding the real cause

Location: `backend/main.py:379-380,535-536`

All provider responses with `status_code >= 400` become `502 "AI provider returned an error"`. The phase docs note real-world 402/403 (credit/limit) responses; mapping everything to 502 with no logging makes these hard to diagnose.

Action: log the upstream status and a truncated body server-side (not to the client). Optionally surface a distinct message for 401/402/403 (configuration/credit) vs 5xx (provider down).

### TEST-1 (Low) — Coverage gaps

- No backend test for `call_openrouter_structured_chat` when the provider returns `status_code >= 400` (the 502 "returned an error" path). Network-failure is covered for smoke only.
- No frontend test for the chat error path (`chatError`) or for `handleSendChat` early-return when `boardData` is null.
- `KanbanCardPreview.tsx` is ~8% covered (drag overlay never exercised in unit tests).

Action: add the three small tests above. The drag-overlay preview is low value to unit test; e2e already covers dragging.

### STYLE-1 (Low) — Minor cleanups

- `backend/main.py:12`: `from fastapi.staticfiles import StaticFiles` sits below the `pydantic` import, breaking the otherwise-grouped import order. Move it up with the other `fastapi` imports.
- `frontend/src/components/AuthGate.tsx:17-18`: login form state defaults to `"user"`/`"password"`. Convenient for the demo and consistent with the on-screen hint, but pre-filling credentials is worth a conscious keep/remove decision.
- `AIChatSidebar` does not auto-scroll to the newest message; long threads require manual scrolling (minor UX).

### AI-1 (High) — AI chat was broken: strict json_schema unsupported by the free model

Location: `backend/ai.py` (`call_openrouter_structured_chat`)

Found while verifying the fixes live: every real `POST /api/ai/chat` returned `502 "AI provider response was invalid"`. The provider returned HTTP 200 but with `finish_reason: "error"`, `content: null`, and an embedded `Upstream error from OpenInference: Unexpected token ... while expecting start token ...`. The free model `openai/gpt-oss-120b:free` does not support the strict `response_format: json_schema` mode — it emitted only `reasoning` with null content, which the backend correctly rejected. The smoke endpoint worked because it sends no `response_format`, and the e2e test passed because it mocks `/api/ai/chat`, so the real provider call was never exercised.

Action: RESOLVED.
- Switched to `response_format: {"type": "json_object"}` (supported by this model) and moved the exact board shape into the system prompt so the model returns null-by-default and a correctly-shaped full board on mutations.
- Added graceful handling: a parseable-but-malformed `board_update` is logged and ignored (the assistant reply is still returned) instead of failing the whole chat; the board is never corrupted. Covered by `test_ai_chat_ignores_malformed_board_update`.
- Verified live: a plain question returns advice with `boardUpdated: false`; "rename Backlog to Planning" returns `boardUpdated: true` with the column renamed, all columns/cards preserved, and the change persisted.

Note: the free tier still occasionally returns a transient null-content error; that surfaces as a clean 502 and the UI shows "AI request failed. Please try again." This is provider variance, not a code defect.

## What looks good

- `merge_ai_board_update` (`backend/main.py:274-333`) is the strongest part of the code: it preserves existing cards/columns, dedupes card placements, and re-homes orphaned cards so malformed AI output cannot corrupt or drop board data. Backed by a dedicated test.
- Structured output uses `json_object` mode with a regex-extraction fallback (`_parse_structured_json`) and lenient `board_update` validation — pragmatic given free models do not honor strict `response_format` (see AI-1).
- Clear separation of API contract vs storage (JSON blob + version), matching the Phase 5 proposal.
- E2E determinism: fresh container per run plus SQLite reset (`frontend/tests/container-webserver.mjs`) is the right call and avoids state leakage.
- `.env` is gitignored and untracked; `.dockerignore` correctly excludes it and `node_modules`/`.next`.

## Suggested action order

All items below are complete (see Remediation status). CONC-1 was documented rather than implemented by design.

1. [x] SEC-1 — signed session token implemented; limitation documented for non-local deployment.
2. [x] BUG-1 — duplicated question removed.
3. [x] PERF-1 — per-request `init_db()` removed.
4. [x] TEST-1 — tests added.
5. [x] DRY-1 / OBS-1 — OpenRouter helper extracted, upstream errors logged.
6. [x] CONC-1 (documented) / STYLE-1 (fixed).
7. [x] AI-1 — chat fixed (json_schema -> json_object).
8. [x] REFACTOR-1 — `main.py` split into modules.
