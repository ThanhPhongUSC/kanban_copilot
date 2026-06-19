# Phase 7 Run Notes

## What Phase 7 Delivers

- Frontend now loads board data from backend API after authentication.
- Frontend persists board edits to backend API.
- Board is persistent across page reloads.
- Existing interactions (rename, add card, delete card, drag/drop) remain intact.

## Frontend Integration Details

- `AuthGate` now handles board API lifecycle:
  - `GET /api/board` after successful session auth.
  - `PUT /api/board` when board changes.
- `KanbanBoard` now supports:
  - external `boardData` input
  - `onBoardChange` callback to persist mutations
- UI states added:
  - loading session
  - loading board
  - board load error + retry
  - save error banner

## Validation Commands

Frontend unit tests with coverage:

```bash
cd frontend
npm run test:unit -- --coverage
```

Backend tests:

```bash
cd backend
python3 -m uv run pytest
```

Frontend e2e tests (Dockerized app):

```bash
cd frontend
npm run test:e2e
```

## Verified Results

- Frontend unit tests pass and remain above 80% coverage target.
- Backend tests pass.
- E2E covers:
  - login and board load
  - add card
  - move card
  - logout
  - persistence after reload
