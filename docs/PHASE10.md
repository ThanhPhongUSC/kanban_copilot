# Phase 10 Run Notes

## What Phase 10 Delivers

- New authenticated sidebar AI chat UI in the board experience.
- Chat request flow from frontend to backend `POST /api/ai/chat`.
- Conversation thread rendering for user/assistant turns.
- Loading and error handling for chat submissions.
- Automatic board refresh when backend reports `boardUpdated: true`.

## Frontend Integration Behavior

- `AuthGate` owns AI chat state and request lifecycle.
- User message is appended immediately.
- Frontend sends:
  - `question`
  - `history` (existing chat turns)
- Backend response is applied as follows:
  - append assistant response to chat
  - if `boardUpdated` is true, replace board state from response
  - keep save/version state in sync with backend payload

## Test Coverage and Validation

Frontend unit tests:

```bash
cd frontend
npm run test:unit -- --coverage
```

Current result:

- 12 tests passed.
- Coverage: 83.48% statements overall.

Backend tests:

```bash
cd backend
python3 -m uv run pytest
```

Current result:

- 19 tests passed.

Frontend e2e tests:

```bash
cd frontend
npm run test:e2e
```

Current result:

- 7 tests passed.
- Includes AI sidebar visibility and AI-applied board update scenario.

## E2E Determinism Updates

- Playwright now runs with a fresh web server instance (`reuseExistingServer: false`) so stale containers do not leak state between runs.
- Containerized e2e startup script resets local SQLite files before starting the app process.
- AI sidebar send button has a stable test id for robust e2e targeting.

## Runtime Note

Live AI behavior remains dependent on OpenRouter account status.
If credits or provider limits block calls, UI/backend still return controlled errors and mock-based integration coverage remains valid.
