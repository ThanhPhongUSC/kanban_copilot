import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthScreen } from "@/components/AuthScreen";
import { installFetchMock, jsonResponse } from "@/test/fetchMock";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AuthScreen", () => {
  it("logs in and notifies the parent", async () => {
    installFetchMock(() => jsonResponse({ status: "ok", user: "user" }));
    const onAuthenticated = vi.fn();
    render(<AuthScreen onAuthenticated={onAuthenticated} />);

    await userEvent.type(screen.getByLabelText("Username"), "user");
    await userEvent.type(screen.getByLabelText("Password"), "password");
    await userEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    expect(onAuthenticated).toHaveBeenCalled();
  });

  it("shows a friendly error for invalid login", async () => {
    installFetchMock(() => jsonResponse({ detail: "Invalid credentials" }, 401));
    render(<AuthScreen onAuthenticated={vi.fn()} />);

    await userEvent.type(screen.getByLabelText("Username"), "user");
    await userEvent.type(screen.getByLabelText("Password"), "nope");
    await userEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Incorrect username or password."
    );
  });

  it("registers via the register tab and surfaces server errors", async () => {
    installFetchMock(() => jsonResponse({ detail: "Username already taken" }, 409));
    render(<AuthScreen onAuthenticated={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: /sign up/i }));
    await userEvent.type(screen.getByLabelText("Username"), "taken");
    await userEvent.type(screen.getByLabelText("Password"), "secret123");
    await userEvent.click(
      screen.getByRole("button", { name: /create account/i })
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Username already taken"
    );
  });
});
