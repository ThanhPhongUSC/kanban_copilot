import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FilterBar } from "@/components/FilterBar";
import { emptyFilter } from "@/lib/kanban";

describe("FilterBar", () => {
  it("propagates text and priority changes", async () => {
    const onChange = vi.fn();
    render(
      <FilterBar
        filter={emptyFilter}
        labels={["design"]}
        assignees={["alice"]}
        onChange={onChange}
      />
    );

    await userEvent.type(screen.getByLabelText("Search cards"), "a");
    expect(onChange).toHaveBeenCalledWith({ ...emptyFilter, text: "a" });

    await userEvent.selectOptions(
      screen.getByLabelText("Filter by priority"),
      "high"
    );
    expect(onChange).toHaveBeenCalledWith({ ...emptyFilter, priority: "high" });
  });

  it("shows a clear control only when a filter is active", async () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <FilterBar filter={emptyFilter} labels={[]} assignees={[]} onChange={onChange} />
    );
    expect(screen.queryByRole("button", { name: /clear/i })).toBeNull();

    rerender(
      <FilterBar
        filter={{ ...emptyFilter, label: "design" }}
        labels={["design"]}
        assignees={[]}
        onChange={onChange}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: /clear/i }));
    expect(onChange).toHaveBeenCalledWith(emptyFilter);
  });
});
