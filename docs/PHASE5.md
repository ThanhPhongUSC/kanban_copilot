# Phase 5: Database Modeling Proposal

## Goal

Define a simple SQLite schema for MVP persistence that stores each user's single board as JSON, while keeping a clean path for future multi-user and richer querying needs.

## Recommended Storage Model

Use one row per user board, with board state stored as JSON text.

Why this model for MVP:

- Matches current frontend board shape directly.
- Minimizes transformation code.
- Keeps implementation simple for Phase 6/7.
- Supports future extension to multiple boards without redesigning users.

## Proposed Schema (SQLite)

```sql
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS boards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT 'My Board',
  board_json TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_boards_user_id ON boards(user_id);
```

## JSON Shape Stored in boards.board_json

The JSON payload should match the current frontend board contract:

```json
{
  "columns": [
    { "id": "col-backlog", "title": "Backlog", "cardIds": ["card-1"] }
  ],
  "cards": {
    "card-1": {
      "id": "card-1",
      "title": "Example",
      "details": "Example details"
    }
  }
}
```

## Bootstrap and Migration Strategy

For Phase 6 implementation:

1. On app startup, ensure database file exists.
2. Run idempotent `CREATE TABLE IF NOT EXISTS` statements.
3. Ensure demo user exists (`user`).
4. Ensure one board row exists for demo user:
   - If missing, insert default board JSON based on current `initialData`.
5. On each board write, update `board_json`, increment `version`, and set `updated_at = datetime('now')`.

This avoids introducing a migration framework before it is needed.

## API Contract vs Storage Boundary

Boundary rule:

- API layer returns/accepts board contract JSON.
- Repository layer owns serialization/deserialization to/from `board_json`.
- API handlers should not contain raw SQL.

Suggested layering for Phase 6:

- `repository`: SQL and row mapping
- `service`: auth/user resolution, validation, business rules
- `api`: request/response model and status codes

## Concurrency and Versioning

MVP approach:

- Single-user local scenario with low write contention.
- Keep `version` column now for forward compatibility.
- Optional next step (later): optimistic concurrency using `If-Match` style version checks.

## Tradeoffs

Pros:

- Very fast to implement.
- Low complexity and low bug surface.
- Exact preservation of frontend board shape.

Cons:

- Querying inside board content is limited compared to normalized tables.
- Partial updates still require read/modify/write of full JSON.

Decision:

- Accept JSON-blob approach for MVP.
- Revisit normalization only if product requires cross-board reporting/search.

## Test Plan for Phase 6 (Based on This Proposal)

Unit tests:

- Serialize/deserialize board JSON round-trip.
- Default board bootstrap path.
- Version increment on save.

Integration tests:

- Empty DB startup creates schema.
- Demo user and board bootstrap correctly.
- Read board, write board, read back persisted changes.
- User scoping enforcement for board operations.

## Sign-Off Request

If approved, Phase 6 will implement this exact schema and bootstrap behavior.