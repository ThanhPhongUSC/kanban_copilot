import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BoardSwitcher } from "@/components/BoardSwitcher";
import type { BoardSummary } from "@/lib/api";

const boards: BoardSummary[] = [
  { id: 1, name: "My Board", role: "owner", columnCount: 3, cardCount: 2, updatedAt: "" },
  { id: 2, name: "Shared Board", role: "editor", columnCount: 3, cardCount: 0, updatedAt: "" },
];

const setup = (overrides: Partial<Parameters<typeof BoardSwitcher>[0]> = {}) => {
  const props = {
    boards,
    selectedBoardId: 1,
    onSelect: vi.fn(),
    onCreate: vi.fn(),
    onDelete: vi.fn(),
    ...overrides,
  };
  render(<BoardSwitcher {...props} />);
  return props;
};

describe("BoardSwitcher", () => {
  it("shows the selected board name and opens the list", async () => {
    setup();
    expect(screen.getByRole("button", { name: /my board/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /my board/i }));
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /shared board/i })).toBeInTheDocument();
  });

  it("selects a board", async () => {
    const props = setup();
    await userEvent.click(screen.getByRole("button", { name: /my board/i }));
    await userEvent.click(screen.getByRole("option", { name: /shared board/i }));
    expect(props.onSelect).toHaveBeenCalledWith(2);
  });

  it("creates a board", async () => {
    const props = setup();
    await userEvent.click(screen.getByRole("button", { name: /my board/i }));
    await userEvent.type(screen.getByLabelText("New board name"), "Q3 Plan");
    await userEvent.click(screen.getByRole("button", { name: /create board/i }));
    expect(props.onCreate).toHaveBeenCalledWith("Q3 Plan");
  });

  it("only offers delete on owned boards", async () => {
    const props = setup();
    await userEvent.click(screen.getByRole("button", { name: /my board/i }));
    expect(screen.queryByRole("button", { name: /delete shared board/i })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /delete my board/i }));
    expect(props.onDelete).toHaveBeenCalledWith(1);
  });
});
