import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthGate } from "@/components/AuthGate";
import { initialData } from "@/lib/kanban";

const fetchMock = vi.fn();

vi.mock("@/components/KanbanBoard", () => ({
  KanbanBoard: ({ boardData }: { boardData?: typeof initialData }) => (
    <div>
      Kanban Board Mock
      <span data-testid="mock-column-title">{boardData?.columns[0]?.title}</span>
    </div>
  ),
}));

describe("AuthGate", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows login form when session is unauthenticated", async () => {
    fetchMock.mockResolvedValueOnce(new Response("", { status: 401 }));

    render(<AuthGate />);

    expect(await screen.findByRole("heading", { name: "Kanban Studio" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("shows board when session is authenticated", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: "ok", user: "user" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: "ok", board: initialData, version: 1 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

    render(<AuthGate />);

    expect(await screen.findByText("Kanban Board Mock")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /log out/i })).toBeInTheDocument();
  });

  it("logs in successfully and renders the board", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response("", { status: 401 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: "ok", user: "user" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: "ok", board: initialData, version: 1 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

    render(<AuthGate />);

    await screen.findByRole("button", { name: /sign in/i });
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText("Kanban Board Mock")).toBeInTheDocument();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/auth/login", expect.any(Object));
    });
  });

  it("shows an error for invalid login credentials", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response("", { status: 401 }))
      .mockResolvedValueOnce(new Response("", { status: 401 }));

    render(<AuthGate />);

    await screen.findByRole("button", { name: /sign in/i });
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Incorrect username or password."
    );
  });

  it("shows load error when board API fails after authentication", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: "ok", user: "user" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockResolvedValueOnce(new Response("", { status: 500 }));

    render(<AuthGate />);

    expect(await screen.findByText(/could not load board/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("sends chat and applies AI board updates", async () => {
    const aiBoard = {
      ...initialData,
      columns: [{ ...initialData.columns[0], title: "AI Renamed Backlog" }, ...initialData.columns.slice(1)],
    };

    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: "ok", user: "user" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: "ok", board: initialData, version: 1 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "ok",
            model: "openai/gpt-oss-120b:free",
            assistantResponse: "I renamed the first column.",
            boardUpdated: true,
            board: aiBoard,
            version: 2,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        )
      );

    render(<AuthGate />);

    expect(await screen.findByText("Kanban Board Mock")).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("AI chat input"), "Please improve the backlog");
    await userEvent.click(screen.getByRole("button", { name: /^send$/i }));

    expect(await screen.findByText("I renamed the first column.")).toBeInTheDocument();
    expect(screen.getByTestId("mock-column-title")).toHaveTextContent("AI Renamed Backlog");

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/ai/chat", expect.any(Object));
    });
  });
});
