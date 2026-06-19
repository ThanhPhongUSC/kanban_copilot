# Phase 3 Run Notes

## What Phase 3 Delivers

- Next.js frontend is built as static export during Docker build.
- Exported frontend assets are copied into `backend/static` in the image.
- FastAPI serves the frontend at `/`.
- FastAPI API routes remain available at `/api/*`.

## Build and Run

From project root (macOS):

```bash
./scripts/start-mac.sh
```

Then verify:

```bash
curl -sS http://localhost:8000/api/health
curl -sS http://localhost:8000/ | rg "Kanban Studio|Single Board Kanban"
```

Expected:

- `/api/health` returns backend health JSON.
- `/` includes Kanban frontend HTML markers such as `Kanban Studio`.

Stop container:

```bash
./scripts/stop-mac.sh
```

## Test Commands

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

Backend tests:

```bash
cd backend
python3 -m uv run pytest
```
