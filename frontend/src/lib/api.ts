import type { BoardData } from "@/lib/kanban";

export type Role = "owner" | "editor";

export type BoardSummary = {
  id: number;
  name: string;
  role: Role;
  columnCount: number;
  cardCount: number;
  updatedAt: string;
};

export type MemberInfo = {
  username: string;
  role: Role;
};

export type BoardDetail = {
  boardId: number;
  name: string;
  role: Role;
  board: BoardData;
  version: number;
  members: MemberInfo[];
};

export type CommentInfo = {
  id: number;
  cardId: string;
  username: string;
  body: string;
  createdAt: string;
};

export type ActivityEntry = {
  id: number;
  username: string;
  action: string;
  detail: string;
  createdAt: string;
};

export type ChatResult = {
  assistantResponse: string;
  boardUpdated: boolean;
  board: BoardData;
  version: number;
};

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const request = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, {
    credentials: "include",
    headers: init?.body
      ? { "Content-Type": "application/json", ...(init?.headers ?? {}) }
      : init?.headers,
    ...init,
  });

  if (!response.ok) {
    let detail = `Request failed (${response.status})`;
    try {
      const data = await response.json();
      if (data?.detail) {
        detail = data.detail;
      }
    } catch {
      // Non-JSON error body; keep the default message.
    }
    throw new ApiError(response.status, detail);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
};

export const api = {
  getSession: () => request<{ user: string }>("/api/auth/session"),
  login: (username: string, password: string) =>
    request<{ user: string }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  register: (username: string, password: string) =>
    request<{ user: string }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  logout: () => request<{ status: string }>("/api/auth/logout", { method: "POST" }),

  listBoards: () =>
    request<{ boards: BoardSummary[] }>("/api/boards").then((r) => r.boards),
  createBoard: (name: string) =>
    request<BoardDetail>("/api/boards", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  getBoard: (boardId: number) => request<BoardDetail>(`/api/boards/${boardId}`),
  saveBoard: (boardId: number, board: BoardData) =>
    request<BoardDetail>(`/api/boards/${boardId}`, {
      method: "PUT",
      body: JSON.stringify(board),
    }),
  renameBoard: (boardId: number, name: string) =>
    request<BoardDetail>(`/api/boards/${boardId}`, {
      method: "PATCH",
      body: JSON.stringify({ name }),
    }),
  deleteBoard: (boardId: number) =>
    request<{ status: string }>(`/api/boards/${boardId}`, { method: "DELETE" }),

  addMember: (boardId: number, username: string) =>
    request<{ members: MemberInfo[] }>(`/api/boards/${boardId}/members`, {
      method: "POST",
      body: JSON.stringify({ username }),
    }).then((r) => r.members),
  removeMember: (boardId: number, username: string) =>
    request<{ members: MemberInfo[] }>(
      `/api/boards/${boardId}/members/${encodeURIComponent(username)}`,
      { method: "DELETE" }
    ).then((r) => r.members),

  listComments: (boardId: number, cardId: string) =>
    request<{ comments: CommentInfo[] }>(
      `/api/boards/${boardId}/comments?cardId=${encodeURIComponent(cardId)}`
    ).then((r) => r.comments),
  addComment: (boardId: number, cardId: string, body: string) =>
    request<{ comments: CommentInfo[] }>(`/api/boards/${boardId}/comments`, {
      method: "POST",
      body: JSON.stringify({ cardId, body }),
    }).then((r) => r.comments),

  listActivity: (boardId: number) =>
    request<{ activity: ActivityEntry[] }>(
      `/api/boards/${boardId}/activity`
    ).then((r) => r.activity),

  sendChat: (
    boardId: number,
    question: string,
    history: { role: string; content: string }[]
  ) =>
    request<ChatResult>("/api/ai/chat", {
      method: "POST",
      body: JSON.stringify({ boardId, question, history }),
    }),
};
