import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KanbanBoard } from "@/components/KanbanBoard";
import { initialData, type BoardData } from "@/lib/kanban";

const getFirstColumn = () => screen.getAllByTestId(/column-/i)[0];

describe("KanbanBoard", () => {
  it("renders five columns", () => {
    render(<KanbanBoard />);
    expect(screen.getAllByTestId(/column-/i)).toHaveLength(5);
  });

  it("renames a column", async () => {
    render(<KanbanBoard />);
    const column = getFirstColumn();
    const input = within(column).getByLabelText("Column title");
    await userEvent.clear(input);
    await userEvent.type(input, "New Name");
    expect(input).toHaveValue("New Name");
  });

  it("adds and removes a card", async () => {
    render(<KanbanBoard />);
    const column = getFirstColumn();
    const addButton = within(column).getByRole("button", {
      name: /add a card/i,
    });
    await userEvent.click(addButton);

    const titleInput = within(column).getByPlaceholderText(/card title/i);
    await userEvent.type(titleInput, "New card");
    const detailsInput = within(column).getByPlaceholderText(/details/i);
    await userEvent.type(detailsInput, "Notes");

    await userEvent.click(within(column).getByRole("button", { name: /add card/i }));

    expect(within(column).getByText("New card")).toBeInTheDocument();

    const deleteButton = within(column).getByRole("button", {
      name: /delete new card/i,
    });
    await userEvent.click(deleteButton);

    expect(within(column).queryByText("New card")).not.toBeInTheDocument();
  });

  it("cancels the add-card form with the cancel icon button", async () => {
    render(<KanbanBoard />);
    const column = getFirstColumn();
    await userEvent.click(
      within(column).getByRole("button", { name: /add a card/i })
    );

    const titleInput = within(column).getByPlaceholderText(/card title/i);
    expect(titleInput).toBeInTheDocument();

    await userEvent.click(within(column).getByRole("button", { name: /cancel/i }));

    expect(
      within(column).queryByPlaceholderText(/card title/i)
    ).not.toBeInTheDocument();
    expect(
      within(column).getByRole("button", { name: /add a card/i })
    ).toBeInTheDocument();
  });

  it("renders safely when card references are stale", () => {
    const boardData = {
      ...initialData,
      columns: initialData.columns.map((column, index) =>
        index === 0
          ? { ...column, cardIds: [...column.cardIds, "card-missing"] }
          : column
      ),
    };

    render(<KanbanBoard boardData={boardData} />);
    expect(screen.getAllByTestId(/column-/i)).toHaveLength(5);
  });

  it("renders card metadata and triggers edit", async () => {
    const boardData: BoardData = {
      columns: [{ id: "col-a", title: "A", cardIds: ["card-rich"] }],
      cards: {
        "card-rich": {
          id: "card-rich",
          title: "Rich card",
          details: "details",
          priority: "high",
          dueDate: "2026-07-01",
          labels: ["design"],
          assignee: "alice",
        },
      },
    };
    const onEditCard = vi.fn();
    render(<KanbanBoard boardData={boardData} onEditCard={onEditCard} />);

    expect(screen.getByText("high")).toBeInTheDocument();
    expect(screen.getByText("design")).toBeInTheDocument();
    expect(screen.getByText("alice")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /edit rich card/i }));
    expect(onEditCard).toHaveBeenCalledWith("card-rich");
  });

  it("hides cards that do not match the active filter", () => {
    const boardData: BoardData = {
      columns: [{ id: "col-a", title: "A", cardIds: ["c1", "c2"] }],
      cards: {
        c1: { id: "c1", title: "Keep me", details: "", priority: "high" },
        c2: { id: "c2", title: "Hide me", details: "", priority: "low" },
      },
    };
    render(
      <KanbanBoard
        boardData={boardData}
        filter={{ text: "", priority: "high", label: "", assignee: "" }}
      />
    );
    expect(screen.getByText("Keep me")).toBeInTheDocument();
    expect(screen.queryByText("Hide me")).toBeNull();
  });
});
