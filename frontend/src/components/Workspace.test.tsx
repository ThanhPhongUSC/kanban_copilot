import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Workspace } from "@/components/Workspace";
import { installFetchMock, jsonResponse } from "@/test/fetchMock";
import type { BoardData } from "@/lib/kanban";

const makeBoard = (title: string): BoardData => ({
  columns: [{ id: "col-a", title, cardIds: [] }],
  cards: {},
});

const makeBoardWithCard = (title: string): BoardData => ({
  columns: [{ id: "col-a", title, cardIds: ["card-1"] }],
  cards: { "card-1": { id: "card-1", title: "Task one", details: "do it" } },
});

type ServerState = {
  boards: { id: number; name: string; role: string; columnCount: number; cardCount: number; updatedAt: string }[];
  detail: Record<number, { boardId: number; name: string; role: string; board: BoardData; version: number; members: { username: string; role: string }[] }>;
};

const buildServer = () => {
  const state: ServerState = {
    boards: [
      { id: 1, name: "My Board", role: "owner", columnCount: 1, cardCount: 0, updatedAt: "" },
    ],
    detail: {
      1: {
        boardId: 1,
        name: "My Board",
        role: "owner",
        board: makeBoardWithCard("Backlog"),
        version: 1,
        members: [{ username: "user", role: "owner" }],
      },
    },
  };

  return installFetchMock((url, method, body) => {
    const path = url.replace(/^https?:\/\/[^/]+/, "");

    if (path === "/api/boards" && method === "GET") {
      return jsonResponse({ status: "ok", boards: state.boards });
    }
    if (path === "/api/boards" && method === "POST") {
      const id = state.boards.length + 1;
      const name = (body as { name: string }).name;
      state.detail[id] = {
        boardId: id,
        name,
        role: "owner",
        board: makeBoard("To Do"),
        version: 1,
        members: [{ username: "user", role: "owner" }],
      };
      state.boards.push({ id, name, role: "owner", columnCount: 1, cardCount: 0, updatedAt: "" });
      return jsonResponse(state.detail[id]);
    }
    const boardMatch = path.match(/^\/api\/boards\/(\d+)$/);
    if (boardMatch) {
      const id = Number(boardMatch[1]);
      if (method === "GET") return jsonResponse(state.detail[id]);
      if (method === "PUT") {
        state.detail[id].board = body as BoardData;
        return jsonResponse(state.detail[id]);
      }
      if (method === "PATCH") {
        state.detail[id].name = (body as { name: string }).name;
        state.boards = state.boards.map((board) =>
          board.id === id ? { ...board, name: state.detail[id].name } : board
        );
        return jsonResponse(state.detail[id]);
      }
      if (method === "DELETE") {
        state.boards = state.boards.filter((board) => board.id !== id);
        delete state.detail[id];
        return jsonResponse({ status: "ok" });
      }
    }
    const memberMatch = path.match(/^\/api\/boards\/(\d+)\/members\/(.+)$/);
    if (memberMatch && method === "DELETE") {
      const id = Number(memberMatch[1]);
      const target = decodeURIComponent(memberMatch[2]);
      state.detail[id].members = state.detail[id].members.filter(
        (member) => member.username !== target
      );
      return jsonResponse({ status: "ok", members: state.detail[id].members });
    }
    if (path.match(/^\/api\/boards\/\d+\/members$/) && method === "POST") {
      const id = Number(path.split("/")[3]);
      state.detail[id].members.push({
        username: (body as { username: string }).username,
        role: "editor",
      });
      return jsonResponse({ status: "ok", members: state.detail[id].members });
    }
    if (path.match(/^\/api\/boards\/\d+\/comments/)) {
      return jsonResponse({ status: "ok", comments: [] });
    }
    if (path.match(/^\/api\/boards\/\d+\/activity$/)) {
      return jsonResponse({
        status: "ok",
        activity: [
          { id: 1, username: "user", action: "created_board", detail: "My Board", createdAt: "" },
        ],
      });
    }
    if (path === "/api/ai/chat" && method === "POST") {
      const id = (body as { boardId: number }).boardId;
      state.detail[id].board = makeBoard("AI Renamed");
      return jsonResponse({
        status: "ok",
        model: "test",
        assistantResponse: "Renamed the column.",
        boardUpdated: true,
        board: state.detail[id].board,
        version: 2,
      });
    }
    return jsonResponse({ detail: "not found" }, 404);
  });
};

beforeEach(() => {
  buildServer();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Workspace", () => {
  it("loads and renders the selected board", async () => {
    render(<Workspace username="user" onLogout={vi.fn()} />);
    expect(await screen.findByDisplayValue("My Board")).toBeInTheDocument();
    expect(await screen.findByTestId("column-col-a")).toBeInTheDocument();
  });

  it("creates and switches to a new board", async () => {
    render(<Workspace username="user" onLogout={vi.fn()} />);
    await screen.findByDisplayValue("My Board");

    await userEvent.click(screen.getByRole("button", { name: /my board/i }));
    await userEvent.type(screen.getByLabelText("New board name"), "Q3 Plan");
    await userEvent.click(screen.getByRole("button", { name: /create board/i }));

    expect(await screen.findByDisplayValue("Q3 Plan")).toBeInTheDocument();
  });

  it("shares the board from the members tab", async () => {
    render(<Workspace username="user" onLogout={vi.fn()} />);
    await screen.findByDisplayValue("My Board");

    await userEvent.click(screen.getByRole("button", { name: /members/i }));
    await userEvent.type(screen.getByLabelText("Invite by username"), "bob");
    await userEvent.click(screen.getByRole("button", { name: /^add$/i }));

    expect(await screen.findByText("bob")).toBeInTheDocument();
  });

  it("shows board activity in the activity tab", async () => {
    render(<Workspace username="user" onLogout={vi.fn()} />);
    await screen.findByDisplayValue("My Board");

    await userEvent.click(screen.getByRole("button", { name: /activity/i }));
    expect(await screen.findByText(/created the board My Board/i)).toBeInTheDocument();
  });

  it("applies AI board updates from the copilot", async () => {
    render(<Workspace username="user" onLogout={vi.fn()} />);
    await screen.findByDisplayValue("My Board");

    await userEvent.type(screen.getByLabelText("AI chat input"), "rename it");
    await userEvent.click(screen.getByTestId("ai-chat-send"));

    expect(await screen.findByText("Renamed the column.")).toBeInTheDocument();
    const column = await screen.findByTestId("column-col-a");
    expect(within(column).getByLabelText("Column title")).toHaveValue("AI Renamed");
  });

  it("hides and reopens the assistant panel", async () => {
    render(<Workspace username="user" onLogout={vi.fn()} />);
    await screen.findByDisplayValue("My Board");

    expect(screen.getByLabelText("AI chat input")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: /hide assistant panel/i })
    );
    expect(screen.queryByLabelText("AI chat input")).toBeNull();

    await userEvent.click(
      screen.getByRole("button", { name: /open assistant panel/i })
    );
    expect(await screen.findByLabelText("AI chat input")).toBeInTheDocument();
  });

  it("edits a card via the card editor", async () => {
    render(<Workspace username="user" onLogout={vi.fn()} />);
    await screen.findByDisplayValue("My Board");

    await userEvent.click(screen.getByRole("button", { name: /edit task one/i }));
    const title = await screen.findByLabelText("Card title");
    await userEvent.clear(title);
    await userEvent.type(title, "Task one updated");
    await userEvent.selectOptions(screen.getByLabelText("Card priority"), "high");
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));

    expect(await screen.findByText("Task one updated")).toBeInTheDocument();
    expect(screen.getByText("high")).toBeInTheDocument();
  });

  it("renames the board from the header", async () => {
    render(<Workspace username="user" onLogout={vi.fn()} />);
    const nameInput = await screen.findByDisplayValue("My Board");

    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "Roadmap");
    await userEvent.tab();

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /roadmap/i })).toBeInTheDocument()
    );
  });

  it("removes a shared member", async () => {
    render(<Workspace username="user" onLogout={vi.fn()} />);
    await screen.findByDisplayValue("My Board");

    await userEvent.click(screen.getByRole("button", { name: /members/i }));
    await userEvent.type(screen.getByLabelText("Invite by username"), "bob");
    await userEvent.click(screen.getByRole("button", { name: /^add$/i }));
    expect(await screen.findByText("bob")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /remove bob/i }));
    await waitFor(() => expect(screen.queryByText("bob")).toBeNull());
  });

  it("deletes a board and falls back to remaining boards", async () => {
    render(<Workspace username="user" onLogout={vi.fn()} />);
    await screen.findByDisplayValue("My Board");

    // Create a second board so deletion has a fallback.
    await userEvent.click(screen.getByRole("button", { name: /my board/i }));
    await userEvent.type(screen.getByLabelText("New board name"), "Temp");
    await userEvent.click(screen.getByRole("button", { name: /create board/i }));
    await screen.findByDisplayValue("Temp");

    await userEvent.click(screen.getByRole("button", { name: /temp/i }));
    await userEvent.click(screen.getByRole("button", { name: /delete temp/i }));

    await waitFor(() =>
      expect(screen.getByDisplayValue("My Board")).toBeInTheDocument()
    );
  });
});
