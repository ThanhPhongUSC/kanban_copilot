import { afterEach, describe, expect, it } from "vitest";
import { api, ApiError } from "@/lib/api";
import { installFetchMock, jsonResponse } from "@/test/fetchMock";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("api client", () => {
  it("unwraps the boards array", async () => {
    installFetchMock(() =>
      jsonResponse({ status: "ok", boards: [{ id: 1, name: "A" }] })
    );
    const boards = await api.listBoards();
    expect(boards).toEqual([{ id: 1, name: "A" }]);
  });

  it("sends JSON content type for requests with a body", async () => {
    const mock = installFetchMock(() => jsonResponse({ user: "alice" }));
    await api.login("alice", "secret");
    const [, init] = mock.mock.calls[0];
    expect((init as RequestInit).method).toBe("POST");
    expect((init as RequestInit).headers).toMatchObject({
      "Content-Type": "application/json",
    });
  });

  it("throws ApiError with the server detail on failure", async () => {
    installFetchMock(() => jsonResponse({ detail: "Username already taken" }, 409));
    await expect(api.register("bob", "secret")).rejects.toMatchObject({
      status: 409,
      message: "Username already taken",
    });
  });

  it("throws ApiError with a fallback message for non-JSON errors", async () => {
    installFetchMock(() => new Response("nope", { status: 500 }));
    const error = await api.getSession().catch((caught) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(500);
  });

  it("unwraps members from membership endpoints", async () => {
    installFetchMock(() =>
      jsonResponse({ status: "ok", members: [{ username: "alice", role: "owner" }] })
    );
    const members = await api.addMember(1, "alice");
    expect(members).toEqual([{ username: "alice", role: "owner" }]);
  });
});
