import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MembersPanel } from "@/components/MembersPanel";
import type { MemberInfo } from "@/lib/api";

const members: MemberInfo[] = [
  { username: "alice", role: "owner" },
  { username: "bob", role: "editor" },
];

describe("MembersPanel", () => {
  it("invites and removes members when the user can manage", async () => {
    const onAdd = vi.fn();
    const onRemove = vi.fn();
    render(
      <MembersPanel
        members={members}
        canManage
        error={null}
        onAdd={onAdd}
        onRemove={onRemove}
      />
    );

    await userEvent.type(screen.getByLabelText("Invite by username"), "carol");
    await userEvent.click(screen.getByRole("button", { name: /^add$/i }));
    expect(onAdd).toHaveBeenCalledWith("carol");

    // Owner row has no remove button; editor does.
    expect(screen.queryByRole("button", { name: /remove alice/i })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /remove bob/i }));
    expect(onRemove).toHaveBeenCalledWith("bob");
  });

  it("hides management for non-owners and shows errors", () => {
    render(
      <MembersPanel
        members={members}
        canManage={false}
        error="Boom"
        onAdd={vi.fn()}
        onRemove={vi.fn()}
      />
    );
    expect(screen.queryByLabelText("Invite by username")).toBeNull();
    expect(screen.getByText(/only the board owner/i)).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Boom");
  });
});
