import json
import os
import re
from typing import Any

import httpx
from fastapi import HTTPException

from config import OPENROUTER_MODEL, OPENROUTER_URL, logger
from models import AIModelStructuredResponse, BoardData, ChatTurn


def _post_openrouter(payload: dict[str, Any], timeout: float) -> dict[str, Any]:
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="AI is not configured")

    try:
        response = httpx.post(
            OPENROUTER_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=timeout,
        )
    except httpx.HTTPError as exc:
        logger.warning("OpenRouter request failed: %s", exc)
        raise HTTPException(status_code=502, detail="AI provider is unavailable") from exc

    if response.status_code >= 400:
        logger.warning(
            "OpenRouter returned %s: %s", response.status_code, response.text[:500]
        )
        raise HTTPException(status_code=502, detail="AI provider returned an error")

    return response.json()


def call_openrouter_smoke(prompt: str) -> str:
    payload = {
        "model": OPENROUTER_MODEL,
        "messages": [
            {
                "role": "system",
                "content": "Answer the user prompt concisely.",
            },
            {"role": "user", "content": prompt},
        ],
        "temperature": 0,
    }

    data = _post_openrouter(payload, timeout=30.0)
    choices = data.get("choices")
    if not isinstance(choices, list) or not choices:
        raise HTTPException(status_code=502, detail="AI provider response was invalid")

    message = choices[0].get("message", {})
    content = message.get("content")
    if not isinstance(content, str) or not content.strip():
        raise HTTPException(status_code=502, detail="AI provider response was invalid")
    return content.strip()


def _extract_message_content(data: dict[str, Any]) -> str:
    choices = data.get("choices")
    if not isinstance(choices, list) or not choices:
        raise HTTPException(status_code=502, detail="AI provider response was invalid")

    message = choices[0].get("message", {})
    content = message.get("content")
    if isinstance(content, str):
        return content.strip()

    if isinstance(content, list):
        text_parts = [part.get("text", "") for part in content if isinstance(part, dict)]
        joined = "".join(text_parts).strip()
        if joined:
            return joined

    raise HTTPException(status_code=502, detail="AI provider response was invalid")


def _parse_structured_json(raw_content: str) -> dict[str, Any]:
    try:
        return json.loads(raw_content)
    except json.JSONDecodeError:
        match = re.search(r"\{[\s\S]*\}", raw_content)
        if not match:
            raise HTTPException(status_code=502, detail="AI provider response was invalid")
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError as exc:
            raise HTTPException(status_code=502, detail="AI provider response was invalid") from exc


# The board shape the model must mirror when it returns a board_update.
BOARD_SHAPE_HINT = (
    '{"columns":[{"id":string,"title":string,"cardIds":[string]}],'
    '"cards":{"<cardId>":{"id":string,"title":string,"details":string}}}'
)

SYSTEM_PROMPT = (
    "You are a project management assistant for a kanban board. "
    "Reply with a SINGLE JSON object and nothing else, with exactly these keys: "
    '"assistant_response" (a short string for the user) and '
    '"board_update" (either null, or the COMPLETE updated board). '
    f"The board object must have this exact shape: {BOARD_SHAPE_HINT}. "
    "Set board_update to null unless the user is explicitly asking to change the board. "
    "When changing it, return the entire board (all columns and cards), preserving existing ids."
)


def _build_structured_response(parsed: Any) -> AIModelStructuredResponse:
    if not isinstance(parsed, dict):
        raise HTTPException(status_code=502, detail="AI provider response was invalid")

    assistant_response = parsed.get("assistant_response")
    if not isinstance(assistant_response, str) or not assistant_response.strip():
        raise HTTPException(status_code=502, detail="AI provider response was invalid")

    board_update = None
    raw_update = parsed.get("board_update")
    if raw_update is not None:
        try:
            board_update = BoardData.model_validate(raw_update)
        except Exception as exc:
            # A malformed board_update must not break the chat or corrupt the board;
            # keep the assistant reply and skip the update.
            logger.warning("Ignoring invalid board_update from model: %s", exc)

    return AIModelStructuredResponse(
        assistant_response=assistant_response.strip(),
        board_update=board_update,
    )


def call_openrouter_structured_chat(
    board: BoardData,
    question: str,
    history: list[ChatTurn],
) -> AIModelStructuredResponse:
    history_text = "\n".join([f"{turn.role}: {turn.content}" for turn in history])
    board_json = json.dumps(board.model_dump(mode="json"), indent=2)

    payload = {
        "model": OPENROUTER_MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    "Current board JSON:\n"
                    f"{board_json}\n\n"
                    "Conversation history:\n"
                    f"{history_text or '(none)'}\n\n"
                    "User question:\n"
                    f"{question}"
                ),
            },
        ],
        "response_format": {"type": "json_object"},
        "temperature": 0,
    }

    data = _post_openrouter(payload, timeout=45.0)
    raw_content = _extract_message_content(data)
    parsed = _parse_structured_json(raw_content)
    return _build_structured_response(parsed)


def merge_ai_board_update(current_board: BoardData, proposed_board: BoardData) -> BoardData:
    current_payload = current_board.model_dump(mode="json")
    proposed_payload = proposed_board.model_dump(mode="json")

    merged_cards: dict[str, dict[str, Any]] = dict(current_payload["cards"])
    merged_cards.update(proposed_payload["cards"])

    proposed_columns_by_id = {
        column["id"]: column for column in proposed_payload["columns"]
    }

    merged_columns: list[dict[str, Any]] = []
    seen_column_ids: set[str] = set()
    for column in current_payload["columns"]:
        replacement = proposed_columns_by_id.get(column["id"])
        if replacement:
            merged_columns.append(
                {
                    "id": column["id"],
                    "title": replacement["title"],
                    "cardIds": list(replacement["cardIds"]),
                }
            )
        else:
            merged_columns.append(
                {
                    "id": column["id"],
                    "title": column["title"],
                    "cardIds": list(column["cardIds"]),
                }
            )
        seen_column_ids.add(column["id"])

    for column in proposed_payload["columns"]:
        if column["id"] not in seen_column_ids:
            merged_columns.append(
                {
                    "id": column["id"],
                    "title": column["title"],
                    "cardIds": list(column["cardIds"]),
                }
            )

    valid_card_ids = set(merged_cards.keys())
    placed_card_ids: set[str] = set()
    for column in merged_columns:
        cleaned_card_ids: list[str] = []
        for card_id in column["cardIds"]:
            if card_id in valid_card_ids and card_id not in placed_card_ids:
                cleaned_card_ids.append(card_id)
                placed_card_ids.add(card_id)
        column["cardIds"] = cleaned_card_ids

    unplaced_cards = [
        card_id for card_id in merged_cards.keys() if card_id not in placed_card_ids
    ]
    if unplaced_cards and merged_columns:
        merged_columns[0]["cardIds"].extend(unplaced_cards)

    return BoardData.model_validate({"columns": merged_columns, "cards": merged_cards})
