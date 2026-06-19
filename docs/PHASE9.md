# Phase 9 Run Notes

## What Phase 9 Delivers

- New authenticated endpoint:
  - `POST /api/ai/chat`
- Endpoint always sends to AI:
  - current board JSON
  - user question
  - conversation history
- AI response is required in structured JSON shape:
  - `assistant_response` (string)
  - `board_update` (full board object or null)
- Backend validates structured output and:
  - returns assistant response
  - persists board only when `board_update` is present

## API Contract

Request:

```json
{
  "question": "What should we do next?",
  "history": [
    { "role": "user", "content": "We need to improve flow." },
    { "role": "assistant", "content": "Let's prioritize review bottlenecks." }
  ]
}
```

Response:

```json
{
  "status": "ok",
  "model": "openai/gpt-oss-120b",
  "assistantResponse": "Focus on ...",
  "boardUpdated": false,
  "board": { "columns": [], "cards": {} },
  "version": 3
}
```

## Validation

Backend tests:

```bash
cd backend
python3 -m uv run pytest
```

Current result: 19 tests passed.

Added coverage includes:

- `/api/ai/chat` auth requirement
- structured response without board update
- structured response with board update persistence
- invalid structured output rejection

## Runtime Note

Live calls to OpenRouter remain provider-billing dependent.
If account credits are unavailable, runtime AI endpoints may return provider errors (`402`/`403`) even though backend implementation is correct.
