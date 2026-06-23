import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KanbanBoard } from "@/components/KanbanBoard";
import { initialData } from "@/lib/kanban";

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
});
