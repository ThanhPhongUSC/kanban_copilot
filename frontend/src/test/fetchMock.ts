import { vi } from "vitest";

export const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export type MockHandler = (
  url: string,
  method: string,
  body: unknown
) => Response | Promise<Response>;

/**
 * Replaces global fetch with a handler that receives the parsed request and
 * returns a Response. Returns the underlying mock so tests can assert calls.
 */
export const installFetchMock = (handler: MockHandler) => {
  const mock = vi.fn(async (url: string, init?: RequestInit) => {
    const method = (init?.method ?? "GET").toUpperCase();
    const body =
      typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
    return handler(String(url), method, body);
  });
  vi.stubGlobal("fetch", mock);
  return mock;
};
