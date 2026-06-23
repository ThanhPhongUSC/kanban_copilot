import sqlite3
from contextlib import asynccontextmanager

from fastapi import Cookie, Depends, FastAPI, HTTPException, Response
from fastapi.staticfiles import StaticFiles

from ai import (
    call_openrouter_smoke,
    call_openrouter_structured_chat,
    merge_ai_board_update,
)
from auth import (
    get_current_username,
    make_session_token,
    resolve_session_user,
    verify_password,
)
from config import (
    COOKIE_SECURE,
    OPENROUTER_MODEL,
    SESSION_COOKIE_NAME,
    STATIC_DIR,
)
from database import (
    add_comment,
    add_member,
    create_board,
    create_user,
    delete_board,
    get_board_record,
    get_role,
    get_user_credentials,
    get_user_id,
    init_db,
    list_activity,
    list_boards_for_user,
    list_comments,
    list_members,
    open_connection,
    record_activity,
    remove_member,
    rename_board,
    save_board,
)
from models import (
    ActivityListResponse,
    AddCommentRequest,
    AddMemberRequest,
    AIChatRequest,
    AIChatResponse,
    AISmokeResponse,
    BoardData,
    BoardListResponse,
    BoardResponse,
    CommentListResponse,
    CreateBoardRequest,
    LoginRequest,
    MemberInfo,
    RegisterRequest,
    RenameBoardRequest,
)


MIN_USERNAME_LENGTH = 3
MAX_USERNAME_LENGTH = 32
MIN_PASSWORD_LENGTH = 6


@asynccontextmanager
async def app_lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(title="PM MVP Backend", lifespan=app_lifespan)


def _require_access(
    connection: sqlite3.Connection,
    board_id: int,
    username: str,
    *,
    owner_only: bool = False,
) -> tuple[int, str]:
    user_id = get_user_id(connection, username)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    role = get_role(connection, board_id, user_id)
    if role is None:
        raise HTTPException(status_code=404, detail="Board not found")
    if owner_only and role != "owner":
        raise HTTPException(status_code=403, detail="Owner access required")
    return user_id, role


def _board_response(
    connection: sqlite3.Connection, board_id: int, role: str
) -> BoardResponse:
    record = get_board_record(connection, board_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Board not found")
    members = [MemberInfo(**member) for member in list_members(connection, board_id)]
    return BoardResponse(
        status="ok",
        boardId=board_id,
        name=record["name"],
        role=role,
        board=BoardData.model_validate(record["board"]),
        version=record["version"],
        members=members,
    )


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "pm-mvp-backend"}


def _set_session_cookie(response: Response, username: str) -> None:
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=make_session_token(username),
        httponly=True,
        samesite="lax",
        secure=COOKIE_SECURE,
        path="/",
    )


@app.post("/api/auth/register")
def register(payload: RegisterRequest, response: Response) -> dict[str, str]:
    username = payload.username.strip()
    if not (MIN_USERNAME_LENGTH <= len(username) <= MAX_USERNAME_LENGTH):
        raise HTTPException(
            status_code=422,
            detail=f"Username must be {MIN_USERNAME_LENGTH}-{MAX_USERNAME_LENGTH} characters",
        )
    if len(payload.password) < MIN_PASSWORD_LENGTH:
        raise HTTPException(
            status_code=422,
            detail=f"Password must be at least {MIN_PASSWORD_LENGTH} characters",
        )

    with open_connection() as connection:
        if get_user_id(connection, username) is not None:
            raise HTTPException(status_code=409, detail="Username already taken")
        user_id = create_user(connection, username, payload.password)
        board_id = create_board(connection, user_id, "My Board")
        record_activity(connection, board_id, user_id, "created_board", "My Board")

    _set_session_cookie(response, username)
    return {"status": "ok", "user": username}


@app.post("/api/auth/login")
def login(payload: LoginRequest, response: Response) -> dict[str, str]:
    with open_connection() as connection:
        credentials = get_user_credentials(connection, payload.username)

    if credentials is None or not verify_password(
        payload.password,
        str(credentials["password_hash"]),
        str(credentials["password_salt"]),
    ):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    _set_session_cookie(response, payload.username)
    return {"status": "ok", "user": payload.username}


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


@app.get("/api/boards", response_model=BoardListResponse)
def get_boards(username: str = Depends(get_current_username)) -> BoardListResponse:
    with open_connection() as connection:
        user_id = get_user_id(connection, username)
        boards = list_boards_for_user(connection, user_id) if user_id else []
    return BoardListResponse(status="ok", boards=boards)


@app.post("/api/boards", response_model=BoardResponse)
def post_board(
    payload: CreateBoardRequest, username: str = Depends(get_current_username)
) -> BoardResponse:
    name = payload.name.strip() or "Untitled Board"
    with open_connection() as connection:
        user_id = get_user_id(connection, username)
        if user_id is None:
            raise HTTPException(status_code=401, detail="Not authenticated")
        board_id = create_board(connection, user_id, name)
        record_activity(connection, board_id, user_id, "created_board", name)
        return _board_response(connection, board_id, "owner")


@app.get("/api/boards/{board_id}", response_model=BoardResponse)
def get_board(
    board_id: int, username: str = Depends(get_current_username)
) -> BoardResponse:
    with open_connection() as connection:
        _, role = _require_access(connection, board_id, username)
        return _board_response(connection, board_id, role)


@app.put("/api/boards/{board_id}", response_model=BoardResponse)
def put_board(
    board_id: int,
    board: BoardData,
    username: str = Depends(get_current_username),
) -> BoardResponse:
    with open_connection() as connection:
        _, role = _require_access(connection, board_id, username)
        save_board(connection, board_id, board)
        return _board_response(connection, board_id, role)


@app.patch("/api/boards/{board_id}", response_model=BoardResponse)
def patch_board(
    board_id: int,
    payload: RenameBoardRequest,
    username: str = Depends(get_current_username),
) -> BoardResponse:
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="Board name cannot be empty")
    with open_connection() as connection:
        user_id, role = _require_access(connection, board_id, username)
        rename_board(connection, board_id, name)
        record_activity(connection, board_id, user_id, "renamed_board", name)
        return _board_response(connection, board_id, role)


@app.delete("/api/boards/{board_id}")
def remove_board(
    board_id: int, username: str = Depends(get_current_username)
) -> dict[str, str]:
    with open_connection() as connection:
        _require_access(connection, board_id, username, owner_only=True)
        delete_board(connection, board_id)
    return {"status": "ok"}


@app.get("/api/boards/{board_id}/members")
def get_members(
    board_id: int, username: str = Depends(get_current_username)
) -> dict[str, object]:
    with open_connection() as connection:
        _require_access(connection, board_id, username)
        members = list_members(connection, board_id)
    return {"status": "ok", "members": members}


@app.post("/api/boards/{board_id}/members")
def post_member(
    board_id: int,
    payload: AddMemberRequest,
    username: str = Depends(get_current_username),
) -> dict[str, object]:
    target = payload.username.strip()
    with open_connection() as connection:
        actor_id, _ = _require_access(connection, board_id, username, owner_only=True)
        target_id = get_user_id(connection, target)
        if target_id is None:
            raise HTTPException(status_code=404, detail="User not found")
        existing_role = get_role(connection, board_id, target_id)
        if existing_role == "owner":
            raise HTTPException(status_code=409, detail="User is the board owner")
        add_member(connection, board_id, target_id, payload.role)
        record_activity(connection, board_id, actor_id, "added_member", target)
        members = list_members(connection, board_id)
    return {"status": "ok", "members": members}


@app.delete("/api/boards/{board_id}/members/{member_username}")
def delete_member(
    board_id: int,
    member_username: str,
    username: str = Depends(get_current_username),
) -> dict[str, object]:
    with open_connection() as connection:
        actor_id, _ = _require_access(connection, board_id, username, owner_only=True)
        target_id = get_user_id(connection, member_username)
        if target_id is None:
            raise HTTPException(status_code=404, detail="User not found")
        remove_member(connection, board_id, target_id)
        record_activity(connection, board_id, actor_id, "removed_member", member_username)
        members = list_members(connection, board_id)
    return {"status": "ok", "members": members}


@app.get("/api/boards/{board_id}/comments", response_model=CommentListResponse)
def get_comments(
    board_id: int,
    cardId: str,
    username: str = Depends(get_current_username),
) -> CommentListResponse:
    with open_connection() as connection:
        _require_access(connection, board_id, username)
        comments = list_comments(connection, board_id, cardId)
    return CommentListResponse(status="ok", comments=comments)


@app.post("/api/boards/{board_id}/comments", response_model=CommentListResponse)
def post_comment(
    board_id: int,
    payload: AddCommentRequest,
    username: str = Depends(get_current_username),
) -> CommentListResponse:
    body = payload.body.strip()
    if not body:
        raise HTTPException(status_code=422, detail="Comment cannot be empty")
    with open_connection() as connection:
        user_id, _ = _require_access(connection, board_id, username)
        add_comment(connection, board_id, payload.cardId, user_id, body)
        record_activity(connection, board_id, user_id, "commented", payload.cardId)
        comments = list_comments(connection, board_id, payload.cardId)
    return CommentListResponse(status="ok", comments=comments)


@app.get("/api/boards/{board_id}/activity", response_model=ActivityListResponse)
def get_activity(
    board_id: int, username: str = Depends(get_current_username)
) -> ActivityListResponse:
    with open_connection() as connection:
        _require_access(connection, board_id, username)
        activity = list_activity(connection, board_id)
    return ActivityListResponse(status="ok", activity=activity)


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
    with open_connection() as connection:
        user_id, _ = _require_access(connection, payload.boardId, username)
        record = get_board_record(connection, payload.boardId)
        if record is None:
            raise HTTPException(status_code=404, detail="Board not found")
        current_board = BoardData.model_validate(record["board"])
        current_version = record["version"]

    model_response = call_openrouter_structured_chat(
        board=current_board,
        question=payload.question,
        history=payload.history,
    )

    if model_response.board_update is not None:
        merged_board = merge_ai_board_update(current_board, model_response.board_update)
        with open_connection() as connection:
            saved_payload, saved_version = save_board(
                connection, payload.boardId, merged_board
            )
            record_activity(
                connection, payload.boardId, user_id, "ai_updated_board", ""
            )
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
