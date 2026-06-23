# Frontend Agent Guide

## Purpose

This directory contains the frontend: a Next.js app for a multi-user project management tool — accounts with self-registration, multiple Kanban boards per user, board sharing, rich cards, comments, an activity feed, and an AI sidebar (`Board Copilot`).

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
- `AuthGate` is a thin session gate: it checks `/api/auth/session`, then renders
  `AuthScreen` (unauthenticated) or `Workspace` (authenticated).
- `AuthScreen` toggles between log in and self-registration.
- `Workspace` is the authenticated hub: it loads the user's boards, owns the
  selected board, persists board state, and wires the right-hand panel and the
  card editor.
- Users can: register/sign in (demo `user` / `password`), log out, create/rename/
  delete boards and switch between them, rename columns, add/edit/delete cards
  (with priority, due date, labels, assignee), comment on cards, filter cards,
  share boards with other users, view an activity feed, and chat with the AI
  copilot (which can update the active board).

## API client

- `src/lib/api.ts` is the single typed fetch client (`api.*`). It always sends
  `credentials: "include"`, sets JSON content-type for bodied requests, and
  throws `ApiError(status, detail)` on non-2xx. Components call `api.*`, not
  `fetch`, directly.

## Source Map

- `src/app/page.tsx`: Home route entrypoint.
- `src/components/AuthGate.tsx`: Session gate; selects `AuthScreen` vs `Workspace`.
- `src/components/AuthScreen.tsx`: Login + register forms.
- `src/components/Workspace.tsx`: Authenticated hub — board list/selection, board
  load/save, members, activity, AI chat state, and card-editor orchestration.
- `src/components/BoardSwitcher.tsx`: Board list dropdown with create/select/delete.
- `src/components/KanbanBoard.tsx`: Board grid + drag/drop; applies the card filter.
- `src/components/KanbanColumn.tsx` / `KanbanCard.tsx`: Column and card UI (card
  renders metadata pills and edit/delete actions).
- `src/components/CardEditor.tsx`: Modal for card fields and comments.
- `src/components/FilterBar.tsx`: Text/priority/label/assignee filter controls.
- `src/components/RightPanel.tsx`: Tabbed sidebar (Copilot / Members / Activity).
- `src/components/AIChatSidebar.tsx`: Chat thread (embedded in `RightPanel`).
- `src/components/MembersPanel.tsx` / `ActivityFeed.tsx`: Sharing and activity UI.
- `src/components/NewCardForm.tsx` / `KanbanCardPreview.tsx`: Add-card form, drag preview.
- `src/lib/api.ts`: Typed API client and response types.
- `src/lib/kanban.ts`: Board/card types, filtering helpers, `moveCard`, ID creation.
- `src/test/fetchMock.ts`: `installFetchMock` helper used by component tests.

## Styling

- Global design tokens are defined in `src/app/globals.css`.
- Brand colors align with project-level palette (yellow, blue, purple, navy, gray).
- Board UI uses utility classes and CSS variables for visual consistency.

## Tests

- Unit/component tests (Vitest + Testing Library), mocking the network with
  `installFetchMock`:
  - `src/lib/kanban.test.ts`: `moveCard` and filtering helpers.
  - `src/lib/api.test.ts`: API client unwrapping and `ApiError` handling.
  - `src/components/AuthGate.test.tsx` / `AuthScreen.test.tsx`: session gate and login/register.
  - `src/components/Workspace.test.tsx`: integration over a stateful fake backend
    (board load, create/switch/delete, rename, card edit, sharing, activity, AI update).
  - Focused tests for `BoardSwitcher`, `CardEditor`, `FilterBar`, `MembersPanel`,
    `ActivityFeed`, and `KanbanBoard` (metadata + filtering).
- E2E tests:
  - `tests/kanban.spec.ts` covers login, registration, multi-board create/switch,
    card add/drag, card-metadata persistence, logout, column-rename persistence,
    AI sidebar visibility, and mocked AI board update.
  - `tests/container-webserver.mjs` starts/stops the Dockerized app and resets the
    persisted DB for deterministic runs.

## NPM Scripts

- `npm run dev`: Start local frontend dev server.
- `npm run build`: Build production frontend.
- `npm run start`: Run production frontend server.
- `npm run test:unit`: Run unit/component tests.
- `npm run test:e2e`: Run Playwright tests.
- `npm run test:all`: Run unit then e2e tests.

## Current Constraints

- Auth uses backend cookie endpoints and hardcoded MVP credentials.
- Frontend assumes board API contract from backend (`status`, `board`, `version`).
- Persistent board data is now backend-managed.
- AI chat behavior depends on backend/provider availability; mocked tests cover structured update paths.

## Agent Working Rules for This Folder

- Keep MVP scope narrow and simple.
- Preserve existing UI behavior unless the active phase requires changes.
- Add tests for every new user-visible behavior.
- Maintain at least 80% unit coverage for new/changed frontend code.
- Avoid introducing extra libraries unless required by a phase goal.
