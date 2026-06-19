# Phase 6 Run Notes

## What Phase 6 Delivers

- SQLite persistence with automatic database bootstrap.
- Users table and boards table are created if missing.
- Demo user row is ensured (`user`).
- One board row per user, board stored as JSON + version.
- New authenticated board APIs:
  - `GET /api/board`
  - `PUT /api/board`

## Auth and Scope

- Auth is cookie-based using backend session cookie (`pm_session`).
- `GET /api/board` and `PUT /api/board` require authenticated session.
- Board operations are scoped to authenticated username.

## Automated Validation

Backend tests:

```bash
cd backend
python3 -m uv run pytest
```

Current result: 11 tests passed.

## Runtime Smoke Validation

1. Start app:

```bash
./scripts/start-mac.sh
```

2. Login and save cookie:

```bash
curl -sS -c /tmp/pm_cookie.txt \
  -H 'Content-Type: application/json' \
  -d '{"username":"user","password":"password"}' \
  http://localhost:8000/api/auth/login
```

3. Read board:

```bash
curl -sS -b /tmp/pm_cookie.txt http://localhost:8000/api/board
```

4. Update board (example title update):

```bash
curl -sS -b /tmp/pm_cookie.txt \
  -H 'Content-Type: application/json' \
  -X PUT --data-binary @/tmp/board_update.json \
  http://localhost:8000/api/board
```

5. Confirm persistence by reading board again.

6. Stop app:

```bash
./scripts/stop-mac.sh
```
