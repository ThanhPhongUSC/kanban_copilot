import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CardEditor } from "@/components/CardEditor";
import type { Card } from "@/lib/kanban";
import { installFetchMock, jsonResponse } from "@/test/fetchMock";

afterEach(() => {
  vi.unstubAllGlobals();
});

const card: Card = {
  id: "card-1",
  title: "Design login",
  details: "Add OAuth",
  priority: "low",
  dueDate: "2026-07-01",
  labels: ["design"],
  assignee: "alice",
};

describe("CardEditor", () => {
  it("loads comments and saves edited fields", async () => {
    installFetchMock((url, method) => {
      if (url.includes("/comments") && method === "GET") {
        return jsonResponse({
          status: "ok",
          comments: [
            { id: 1, cardId: "card-1", username: "bob", body: "Nice", createdAt: "" },
          ],
        });
      }
      return jsonResponse({ status: "ok", comments: [] });
    });

    const onSave = vi.fn();
    render(
      <CardEditor
        boardId={7}
        card={card}
        memberUsernames={["alice", "bob"]}
        onSave={onSave}
        onClose={vi.fn()}
      />
    );

    expect(await screen.findByText("Nice")).toBeInTheDocument();

    const title = screen.getByLabelText("Card title");
    await userEvent.clear(title);
    await userEvent.type(title, "Design login page");
    await userEvent.selectOptions(screen.getByLabelText("Card priority"), "high");
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "card-1",
        title: "Design login page",
        priority: "high",
        labels: ["design"],
      })
    );
  });

  it("posts a new comment", async () => {
    const mock = installFetchMock((url, method) => {
      if (url.includes("/comments") && method === "POST") {
        return jsonResponse({
          status: "ok",
          comments: [
            { id: 2, cardId: "card-1", username: "alice", body: "Done", createdAt: "" },
          ],
        });
      }
      return jsonResponse({ status: "ok", comments: [] });
    });

    render(
      <CardEditor
        boardId={7}
        card={card}
        memberUsernames={[]}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />
    );

    await userEvent.type(screen.getByLabelText("New comment"), "Done");
    await userEvent.click(screen.getByRole("button", { name: /^post$/i }));

    expect(await screen.findByText("Done")).toBeInTheDocument();
    await waitFor(() => {
      expect(
        mock.mock.calls.some(
          ([, init]) => (init as RequestInit | undefined)?.method === "POST"
        )
      ).toBe(true);
    });
  });
});
