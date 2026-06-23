import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthGate } from "@/components/AuthGate";
import { installFetchMock, jsonResponse } from "@/test/fetchMock";

vi.mock("@/components/Workspace", () => ({
  Workspace: ({ username }: { username: string }) => (
    <div>Workspace for {username}</div>
  ),
}));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AuthGate", () => {
  it("shows the auth screen when there is no session", async () => {
    installFetchMock(() => jsonResponse({ detail: "Not authenticated" }, 401));
    render(<AuthGate />);
    expect(
      await screen.findByRole("heading", { name: "Kanban Studio" })
    ).toBeInTheDocument();
  });

  it("shows the workspace when a session exists", async () => {
    installFetchMock(() => jsonResponse({ status: "ok", user: "alice" }));
    render(<AuthGate />);
    expect(await screen.findByText("Workspace for alice")).toBeInTheDocument();
  });

  it("authenticates after a successful login", async () => {
    let authed = false;
    installFetchMock((url, method) => {
      if (url.endsWith("/api/auth/session")) {
        return authed
          ? jsonResponse({ status: "ok", user: "user" })
          : jsonResponse({ detail: "Not authenticated" }, 401);
      }
      if (url.endsWith("/api/auth/login") && method === "POST") {
        authed = true;
        return jsonResponse({ status: "ok", user: "user" });
      }
      return jsonResponse({}, 404);
    });

    render(<AuthGate />);
    await screen.findByRole("button", { name: /^sign in$/i });
    await userEvent.type(screen.getByLabelText("Username"), "user");
    await userEvent.type(screen.getByLabelText("Password"), "password");
    await userEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    expect(await screen.findByText("Workspace for user")).toBeInTheDocument();
  });
});
