# Backend Agent Guide

## Purpose

The backend directory contains the FastAPI service that will:

- Serve static site assets at `/`
- Expose API routes under `/api/*`
- Manage auth/session and persistence for the MVP
- Integrate with OpenRouter for AI features in later phases

## Current Phase 2 Contents

- `main.py`: FastAPI app with `/` static hello page and `/api/health` endpoint.
- `static/index.html`: hello-world page that also calls `/api/health`.
- `tests/test_app.py`: backend tests for health endpoint and root page serving.
- `pyproject.toml`: backend dependencies and pytest configuration.

## Working Rules

- Keep API routes grouped under `/api/*`.
- Keep behavior simple and explicit.
- Add tests with each behavior change.
- Preserve MVP scope and avoid adding features early.