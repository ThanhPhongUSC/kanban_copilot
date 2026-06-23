import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ActivityFeed } from "@/components/ActivityFeed";
import type { ActivityEntry } from "@/lib/api";

describe("ActivityFeed", () => {
  it("renders an empty state", () => {
    render(<ActivityFeed activity={[]} />);
    expect(screen.getByText(/no activity yet/i)).toBeInTheDocument();
  });

  it("describes known and unknown actions", () => {
    const activity: ActivityEntry[] = [
      { id: 1, username: "alice", action: "renamed_board", detail: "Roadmap", createdAt: "" },
      { id: 2, username: "bob", action: "custom_thing", detail: "", createdAt: "" },
    ];
    render(<ActivityFeed activity={activity} />);
    expect(screen.getByText(/renamed the board Roadmap/i)).toBeInTheDocument();
    expect(screen.getByText(/custom thing/i)).toBeInTheDocument();
  });
});
