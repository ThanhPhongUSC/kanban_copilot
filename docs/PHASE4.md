# Phase 4 Run Notes

## What Phase 4 Delivers

- Login is required before viewing the Kanban board.
- Backend cookie auth endpoints are implemented with hardcoded credentials:
  - `POST /api/auth/login`
  - `POST /api/auth/logout`
  - `GET /api/auth/session`
- Session is managed by backend HTTP-only cookie.
- Frontend shows login UI when not authenticated and logout action when authenticated.

## Demo Credentials

- Username: `user`
- Password: `password`

## Manual Verification

1. Start app:

```bash
./scripts/start-mac.sh
```

2. Open `http://localhost:8000/`.

3. Confirm login screen appears first.

4. Sign in with `user` / `password`.

5. Confirm Kanban board appears.

6. Click `Log out`.

7. Confirm you return to the login screen.

8. Stop app:

```bash
./scripts/stop-mac.sh
```

## Automated Verification Commands

Backend tests:

```bash
cd backend
python3 -m uv run pytest
```

Frontend unit tests with coverage:

```bash
cd frontend
npm run test:unit -- --coverage
```

Frontend e2e integration tests:

```bash
cd frontend
npm run test:e2e
```

Note: e2e now runs against the Dockerized app (`http://127.0.0.1:8000`) and manages container lifecycle automatically.
