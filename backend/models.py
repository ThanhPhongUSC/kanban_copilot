from pydantic import BaseModel


class LoginRequest(BaseModel):
    username: str
    password: str


class Card(BaseModel):
    id: str
    title: str
    details: str


class Column(BaseModel):
    id: str
    title: str
    cardIds: list[str]


class BoardData(BaseModel):
    columns: list[Column]
    cards: dict[str, Card]


class BoardResponse(BaseModel):
    status: str
    board: BoardData
    version: int


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
