# Backend Agent Guide

## Purpose

The backend directory contains the FastAPI service that will:

- Serve static site assets at `/`
- Expose API routes under `/api/*`
- Manage auth/session and persistence for the MVP
- Integrate with OpenRouter for AI features in later phases

## Current Phase 9 Status

- `main.py` includes:
	- `/api/health`
	- `/api/auth/login`
	- `/api/auth/logout`
	- `/api/auth/session`
	- `/api/board` (GET)
	- `/api/board` (PUT)
	- `/api/ai/smoke` (GET)
	- `/api/ai/chat` (POST)
	- static frontend serving at `/`
- Auth uses a backend-managed HTTP-only cookie (`pm_session`).
- MVP credentials are hardcoded to `user` / `password`.
- SQLite database is auto-created if missing.
- Users and boards are persisted in SQLite.
- Board state is stored as JSON plus a version field.
- AI smoke call uses OpenRouter model `openai/gpt-oss-120b:free`.
- AI smoke requires `OPENROUTER_API_KEY` in runtime environment.
- AI chat sends board JSON, user question, and conversation history to model.
- AI chat requires structured JSON response with assistant text and optional `board_update`.
- When `board_update` is returned, backend validates and persists it.
- In Docker runtime, `backend/static` is populated from the exported Next.js build.

## Working Rules

- Keep API routes grouped under `/api/*`.
- Keep behavior simple and explicit.
- Add tests with each behavior change.
- Preserve MVP scope and avoid adding features early.