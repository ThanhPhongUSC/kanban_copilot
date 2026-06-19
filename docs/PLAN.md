# Project Management MVP Plan

This plan is execution-ready and approval-gated. Work proceeds phase-by-phase, and each phase pauses for user approval before moving to the next phase.

## Delivery Rules

- Scope: MVP only, no extra features.
- Runtime: local, single Docker container.
- Frontend: Next.js static build served by FastAPI at `/`.
- Backend: FastAPI + SQLite.
- Python package manager in container: `uv`.
- AI provider/model: OpenRouter with `openai/gpt-oss-120b`.
- Auth approach for MVP: backend cookie-based session with hardcoded credentials (`user` / `password`).

## Quality Gates

- Unit coverage target: at least 80% for code introduced in each phase and maintained at project level where practical.
- Integration testing: robust integration tests for each user-facing or API-facing capability introduced in a phase.
- Regression protection: existing tests stay green unless intentionally replaced with equivalent coverage.
- Approval gate: after each phase, provide a short report and wait for approval.

## Phase 1: Plan and Frontend Inventory

### Checklist

- [x] Expand `docs/PLAN.md` with detailed phase checklists, tests, and success criteria.
- [x] Create `frontend/AGENTS.md` documenting current frontend architecture and behavior.
- [x] Confirm test strategy and acceptance criteria with the user.
- [x] Pause for user approval.

### Tests

- [x] Documentation sanity check: verify referenced paths and commands exist.

### Success Criteria

- [x] Plan is explicit enough to execute without guessing.
- [x] User explicitly approves the plan before Phase 2.

## Phase 2: Scaffolding (Docker + FastAPI Hello World)

### Checklist

- [x] Create backend project scaffold in `backend/` using FastAPI.
- [x] Add Dockerfile and any minimal supporting files for a single-container runtime.
- [x] Add platform scripts in `scripts/` to start/stop the app on macOS, Linux, and Windows.
- [x] Implement a simple `/api/health` endpoint.
- [x] Serve simple static HTML at `/` to prove frontend serving path from backend.
- [x] Document run commands and expected behavior.
- [x] Pause for user approval.

### Tests

- [x] Backend unit test: health endpoint returns success payload.
- [x] Integration test: container starts and serves HTML on `/`.
- [x] Integration test: `/api/health` reachable from running container.

### Success Criteria

- [x] One command starts the single container locally.
- [x] Browser request to `/` returns hello-world page.
- [x] API call to `/api/health` succeeds.

## Phase 3: Add Existing Frontend Into Containerized App

### Checklist

- [x] Build Next.js frontend as static assets.
- [x] Wire backend static serving to deliver built frontend at `/`.
- [x] Ensure asset paths and refresh behavior work in local container.
- [x] Preserve existing Kanban interactions.
- [x] Pause for user approval.

### Tests

- [x] Frontend unit tests pass in CI-like mode.
- [x] Integration test: backend serves compiled frontend HTML and assets.
- [x] E2E smoke test: Kanban board renders at `/` with expected columns.

### Success Criteria

- [x] Existing demo Kanban works through backend-served route.
- [x] No local dependency on separate frontend dev server for MVP run path.

## Phase 4: Fake Sign-In With Backend Cookies

### Checklist

- [x] Add login UI and route flow.
- [x] Add backend login endpoint for hardcoded credentials.
- [x] Set secure cookie settings suitable for local MVP (HTTP-only where possible).
- [x] Add logout endpoint and UI action.
- [x] Protect board route so unauthenticated users are redirected/blocked.
- [x] Pause for user approval.

### Tests

- [x] Backend unit tests for login/logout/session validation logic.
- [x] Integration tests: successful and failed login flows.
- [x] Integration tests: protected endpoint requires session cookie.
- [x] E2E: login required before board access; logout returns to login screen.

### Success Criteria

- [x] Only `user` / `password` can authenticate.
- [x] Session is managed by backend cookie.
- [x] Logout clears session and blocks board access.

## Phase 5: Database Modeling (Proposal + Approval)

### Checklist

- [x] Propose SQLite schema for MVP kanban persistence (JSON-focused approach to be finalized).
- [x] Document data model, migrations/bootstrap, and tradeoffs in `docs/`.
- [x] Define clear ownership boundaries between API contracts and storage schema.
- [x] Request user sign-off before implementation.
- [x] Pause for user approval.

### Tests

- [ ] Schema validation tests for create/read/update round-trips. (Planned for Phase 6 implementation)
- [ ] Migration/bootstrap test for empty database creation. (Planned for Phase 6 implementation)

### Success Criteria

- [x] User signs off on schema and persistence approach.
- [x] Schema supports one board per user now, extensible for multi-user future.

## Phase 6: Backend Kanban APIs + Persistence

### Checklist

- [x] Implement backend repository/service layer for board read/write.
- [x] Add API endpoints for fetch/update board state.
- [x] Enforce authenticated user scoping.
- [x] Auto-create SQLite database if missing.
- [x] Add input/output validation and error handling.
- [ ] Pause for user approval.

### Tests

- [x] Unit tests for service/repository logic.
- [x] Integration tests for API contracts and persistence behavior.
- [x] Integration tests for auth enforcement on board APIs.

### Success Criteria

- [x] Board changes persist across restarts.
- [x] Unauthorized access is rejected.
- [x] Database auto-initializes when missing.

## Phase 7: Frontend + Backend Integration

### Checklist

- [ ] Replace in-memory frontend board initialization with backend API data.
- [ ] Persist card/column edits through API.
- [ ] Add loading, empty, and error states that keep UX simple.
- [ ] Keep drag-and-drop behavior consistent with backend persistence.
- [ ] Pause for user approval.

### Tests

- [ ] Unit tests for API client and state update logic.
- [ ] Integration tests for optimistic/non-optimistic update behavior.
- [ ] E2E: create/edit/move card survives page reload.

### Success Criteria

- [ ] Board is fully persistent.
- [ ] Reload shows last saved state.
- [ ] Core kanban interactions remain stable.

## Phase 8: AI Connectivity (OpenRouter Smoke)

### Checklist

- [ ] Add backend AI client wrapper using OpenRouter API key from `.env`.
- [ ] Implement simple diagnostic route or internal check for AI call.
- [ ] Validate model usage with `openai/gpt-oss-120b`.
- [ ] Perform smoke prompt test (`2+2`).
- [ ] Pause for user approval.

### Tests

- [ ] Unit tests with mocked AI client.
- [ ] Integration test with mocked provider path and error handling.
- [ ] Optional manual live smoke check in local environment.

### Success Criteria

- [ ] Backend can make successful OpenRouter request.
- [ ] Failure cases return clear, safe errors.

## Phase 9: Structured Output for Kanban-Aware AI

### Checklist

- [ ] Define structured response schema for assistant reply + optional board mutation.
- [ ] Send board JSON, user question, and conversation context to AI.
- [ ] Validate and parse structured output safely.
- [ ] Apply optional board updates through backend persistence path.
- [ ] Pause for user approval.

### Tests

- [ ] Unit tests for schema parsing and validation.
- [ ] Unit tests for mutation application rules.
- [ ] Integration tests for end-to-end AI response handling with mocks.

### Success Criteria

- [ ] AI response is deterministic in shape.
- [ ] Optional board updates are validated before apply.
- [ ] Invalid AI output cannot corrupt board state.

## Phase 10: Sidebar AI Chat UX + Live Board Refresh

### Checklist

- [ ] Build sidebar chat UI integrated with backend AI endpoint.
- [ ] Render conversation thread and loading/error states.
- [ ] Apply AI-requested board updates and refresh UI automatically.
- [ ] Keep existing board interactions intact.
- [ ] Final pass on docs and scripts.
- [ ] Pause for final user approval.

### Tests

- [ ] Unit tests for chat UI state management.
- [ ] Integration tests for chat request/response flow.
- [ ] E2E: ask AI, receive response, and verify board updates when returned.

### Success Criteria

- [ ] AI chat is functional from UI to backend to model and back.
- [ ] Board refreshes automatically after AI-driven changes.
- [ ] Project meets coverage and integration quality gates.

## Notes and Open Decisions

- Database schema detail for Parts 5-7: deferred for dedicated sign-off.
- Conversation persistence detail for Parts 9-10: deferred for dedicated sign-off.
- Structured output schema details for Parts 9-10: deferred for dedicated sign-off.