# Frontend Agent Guide

## Purpose

This directory contains the current MVP frontend: a Next.js app that renders a single interactive kanban board.

## Stack

- Next.js 16 (App Router)
- React 19
- TypeScript
- Tailwind CSS 4
- dnd-kit for drag-and-drop
- Vitest + Testing Library for unit/component tests
- Playwright for end-to-end tests

## Current App Behavior

- Route `/` renders `src/app/page.tsx`, which mounts `AuthGate`.
- `AuthGate` checks backend session at `/api/auth/session`.
- Unauthenticated users see a login form.
- Authenticated users see the Kanban board and a logout action.
- Board state is currently local/in-memory (no backend persistence yet).
- The board has five columns by default.
- Users can:
  - Sign in with demo credentials (`user` / `password`).
  - Log out.
  - Rename columns inline.
  - Add a card with title/details.
  - Remove a card.
  - Drag/drop cards within and across columns.

## Source Map

- `src/app/page.tsx`: Home route entrypoint.
- `src/components/KanbanBoard.tsx`: Top-level board state and drag/drop orchestration.
- `src/components/AuthGate.tsx`: Login/session gate and logout behavior.
- `src/components/KanbanColumn.tsx`: Column rendering, title editing, add-card entrypoint.
- `src/components/KanbanCard.tsx`: Sortable card UI and delete action.
- `src/components/NewCardForm.tsx`: Inline add-card form.
- `src/components/KanbanCardPreview.tsx`: Drag overlay preview.
- `src/lib/kanban.ts`: Types, initial board data, ID creation, and `moveCard` logic.

## Styling

- Global design tokens are defined in `src/app/globals.css`.
- Brand colors align with project-level palette (yellow, blue, purple, navy, gray).
- Board UI uses utility classes and CSS variables for visual consistency.

## Tests

- Unit/component tests:
  - `src/lib/kanban.test.ts` verifies `moveCard` logic.
  - `src/components/AuthGate.test.tsx` verifies auth gate states and login handling.
  - `src/components/KanbanBoard.test.tsx` verifies render, rename, add/remove card flows.
- E2E tests:
  - `tests/kanban.spec.ts` covers login, board load, card add, card drag, and logout flow.
  - `tests/container-webserver.mjs` starts/stops the Dockerized app for e2e execution.

## NPM Scripts

- `npm run dev`: Start local frontend dev server.
- `npm run build`: Build production frontend.
- `npm run start`: Run production frontend server.
- `npm run test:unit`: Run unit/component tests.
- `npm run test:e2e`: Run Playwright tests.
- `npm run test:all`: Run unit then e2e tests.

## Current Constraints

- Auth uses backend cookie endpoints and hardcoded MVP credentials.
- No backend API integration yet.
- No persisted data yet.
- No AI sidebar/chat yet.

## Agent Working Rules for This Folder

- Keep MVP scope narrow and simple.
- Preserve existing UI behavior unless the active phase requires changes.
- Add tests for every new user-visible behavior.
- Maintain at least 80% unit coverage for new/changed frontend code.
- Avoid introducing extra libraries unless required by a phase goal.
