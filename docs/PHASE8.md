# Phase 8 Run Notes

## What Phase 8 Delivers

- Backend OpenRouter AI smoke integration is implemented.
- Authenticated endpoint added:
  - `GET /api/ai/smoke`
- Endpoint sends prompt `2+2` to model `openai/gpt-oss-120b:free`.
- Endpoint includes robust failure responses:
  - `503` when API key is missing
  - `502` when provider is unavailable or returns invalid response

## Automated Validation

Backend tests:

```bash
cd backend
python3 -m uv run pytest
```

Current result: 15 tests passed (includes AI smoke success/failure coverage with mocks).

## Live Connectivity Check (Current Status)

Attempted runtime smoke call in Docker:

- Login succeeded.
- `GET /api/ai/smoke` returned `{"detail":"AI is not configured"}`.

Root cause:

- Project `.env` is empty, so `OPENROUTER_API_KEY` is not set in container.

## To Complete Live Smoke

1. Add API key to project root `.env`:

```env
OPENROUTER_API_KEY=your_real_key_here
```

2. Restart container:

```bash
./scripts/start-mac.sh
```

3. Authenticate and call smoke endpoint:

```bash
curl -sS -c /tmp/pm_cookie.txt \
  -H 'Content-Type: application/json' \
  -d '{"username":"user","password":"password"}' \
  http://localhost:8000/api/auth/login

curl -sS -b /tmp/pm_cookie.txt http://localhost:8000/api/ai/smoke
```

Expected successful response shape:

```json
{
  "status": "ok",
  "model": "openai/gpt-oss-120b:free",
  "prompt": "What is 2+2? Reply with only the final number.",
  "answer": "4"
}
```
