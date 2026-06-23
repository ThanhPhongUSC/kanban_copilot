from typing import Literal, Optional

from pydantic import BaseModel


class LoginRequest(BaseModel):
    username: str
    password: str


class RegisterRequest(BaseModel):
    username: str
    password: str


class Card(BaseModel):
    id: str
    title: str
    details: str = ""
    priority: Optional[Literal["low", "medium", "high"]] = None
    dueDate: Optional[str] = None
    labels: list[str] = []
    assignee: Optional[str] = None


class Column(BaseModel):
    id: str
    title: str
    cardIds: list[str]


class BoardData(BaseModel):
    columns: list[Column]
    cards: dict[str, Card]


class MemberInfo(BaseModel):
    username: str
    role: str


class BoardResponse(BaseModel):
    status: str
    boardId: int
    name: str
    role: str
    board: BoardData
    version: int
    members: list[MemberInfo] = []


class BoardSummary(BaseModel):
    id: int
    name: str
    role: str
    columnCount: int
    cardCount: int
    updatedAt: str


class BoardListResponse(BaseModel):
    status: str
    boards: list[BoardSummary]


class CreateBoardRequest(BaseModel):
    name: str


class RenameBoardRequest(BaseModel):
    name: str


class AddMemberRequest(BaseModel):
    username: str
    role: Literal["editor"] = "editor"


class CommentInfo(BaseModel):
    id: int
    cardId: str
    username: str
    body: str
    createdAt: str


class CommentListResponse(BaseModel):
    status: str
    comments: list[CommentInfo]


class AddCommentRequest(BaseModel):
    cardId: str
    body: str


class ActivityEntry(BaseModel):
    id: int
    username: str
    action: str
    detail: str
    createdAt: str


class ActivityListResponse(BaseModel):
    status: str
    activity: list[ActivityEntry]


class AISmokeResponse(BaseModel):
    status: str
    model: str
    prompt: str
    answer: str


class ChatTurn(BaseModel):
    role: str
    content: str


class AIChatRequest(BaseModel):
    question: str
    history: list[ChatTurn] = []
    boardId: int


class AIModelStructuredResponse(BaseModel):
    assistant_response: str
    board_update: BoardData | None = None


class AIChatResponse(BaseModel):
    status: str
    model: str
    assistantResponse: str
    boardUpdated: bool
    board: BoardData
    version: int
