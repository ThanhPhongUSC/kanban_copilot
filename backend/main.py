from contextlib import asynccontextmanager

from fastapi import Cookie, Depends, FastAPI, HTTPException, Response
from fastapi.staticfiles import StaticFiles

from ai import (
    call_openrouter_smoke,
    call_openrouter_structured_chat,
    merge_ai_board_update,
)
from auth import get_current_username, make_session_token, resolve_session_user
from config import (
    COOKIE_SECURE,
    DEMO_PASSWORD,
    DEMO_USERNAME,
    OPENROUTER_MODEL,
    SESSION_COOKIE_NAME,
    STATIC_DIR,
)
from database import (
    ensure_user,
    get_board_for_user,
    init_db,
    open_connection,
    save_board_for_user,
)
from models import (
    AIChatRequest,
    AIChatResponse,
    AISmokeResponse,
    BoardData,
    BoardResponse,
    LoginRequest,
)


@asynccontextmanager
async def app_lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(title="PM MVP Backend", lifespan=app_lifespan)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "pm-mvp-backend"}


@app.post("/api/auth/login")
def login(payload: LoginRequest, response: Response) -> dict[str, str]:
    if payload.username != DEMO_USERNAME or payload.password != DEMO_PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    with open_connection() as connection:
        ensure_user(connection, payload.username)

    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=make_session_token(payload.username),
        httponly=True,
        samesite="lax",
        secure=COOKIE_SECURE,
        path="/",
    )
    return {"status": "ok", "user": DEMO_USERNAME}


@app.post("/api/auth/logout")
def logout(response: Response) -> dict[str, str]:
    response.delete_cookie(key=SESSION_COOKIE_NAME, path="/")
    return {"status": "ok"}


@app.get("/api/auth/session")
def session(pm_session: str | None = Cookie(default=None)) -> dict[str, str]:
    username = resolve_session_user(pm_session)
    if not username:
        raise HTTPException(status_code=401, detail="Not authenticated")

    return {"status": "ok", "user": username}


@app.get("/api/board", response_model=BoardResponse)
def get_board(username: str = Depends(get_current_username)) -> BoardResponse:
    board_payload, version = get_board_for_user(username)
    return BoardResponse(status="ok", board=BoardData.model_validate(board_payload), version=version)


@app.put("/api/board", response_model=BoardResponse)
def update_board(board: BoardData, username: str = Depends(get_current_username)) -> BoardResponse:
    saved_payload, version = save_board_for_user(username, board)
    return BoardResponse(status="ok", board=BoardData.model_validate(saved_payload), version=version)


@app.get("/api/ai/smoke", response_model=AISmokeResponse)
def ai_smoke(_: str = Depends(get_current_username)) -> AISmokeResponse:
    prompt = "What is 2+2? Reply with only the final number."
    answer = call_openrouter_smoke(prompt)
    return AISmokeResponse(
        status="ok",
        model=OPENROUTER_MODEL,
        prompt=prompt,
        answer=answer,
    )


@app.post("/api/ai/chat", response_model=AIChatResponse)
def ai_chat(
    payload: AIChatRequest,
    username: str = Depends(get_current_username),
) -> AIChatResponse:
    current_board_payload, current_version = get_board_for_user(username)
    current_board = BoardData.model_validate(current_board_payload)

    model_response = call_openrouter_structured_chat(
        board=current_board,
        question=payload.question,
        history=payload.history,
    )

    if model_response.board_update is not None:
        merged_board = merge_ai_board_update(current_board, model_response.board_update)
        saved_payload, saved_version = save_board_for_user(username, merged_board)
        return AIChatResponse(
            status="ok",
            model=OPENROUTER_MODEL,
            assistantResponse=model_response.assistant_response,
            boardUpdated=True,
            board=BoardData.model_validate(saved_payload),
            version=saved_version,
        )

    return AIChatResponse(
        status="ok",
        model=OPENROUTER_MODEL,
        assistantResponse=model_response.assistant_response,
        boardUpdated=False,
        board=current_board,
        version=current_version,
    )


app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="frontend")
