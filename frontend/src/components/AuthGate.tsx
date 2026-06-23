"use client";

import { FormEvent, useEffect, useState } from "react";
import { AIChatSidebar } from "@/components/AIChatSidebar";
import { KanbanBoard } from "@/components/KanbanBoard";
import { LogoutIcon } from "@/components/icons";
import type { BoardData } from "@/lib/kanban";

type AuthState = "loading" | "authenticated" | "unauthenticated";

type AIChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export const AuthGate = () => {
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [username, setUsername] = useState("user");
  const [password, setPassword] = useState("password");
  const [error, setError] = useState<string | null>(null);
  const [boardError, setBoardError] = useState<string | null>(null);
  const [boardData, setBoardData] = useState<BoardData | null>(null);
  const [boardReloadToken, setBoardReloadToken] = useState(0);
  const [chatMessages, setChatMessages] = useState<AIChatMessage[]>([]);
  const [chatError, setChatError] = useState<string | null>(null);
  const [isChatSubmitting, setIsChatSubmitting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const loadSession = async () => {
      try {
        const response = await fetch("/api/auth/session", {
          credentials: "include",
        });
        if (response.ok) {
          setAuthState("authenticated");
          return;
        }
      } catch {
        // Keep the fallback path simple for MVP and show login screen.
      }
      setAuthState("unauthenticated");
    };

    void loadSession();
  }, []);

  useEffect(() => {
    if (authState !== "authenticated") {
      return;
    }

    const loadBoard = async () => {
      try {
        setBoardError(null);
        const response = await fetch("/api/board", {
          credentials: "include",
        });

        if (!response.ok) {
          setBoardError("Unable to load board. Please try again.");
          return;
        }

        const payload = (await response.json()) as {
          board: BoardData;
        };
        setBoardData(payload.board);
      } catch {
        setBoardError("Unable to load board. Please try again.");
      }
    };

    void loadBoard();
  }, [authState, boardReloadToken]);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        setError("Incorrect username or password.");
        return;
      }

      setAuthState("authenticated");
    } catch {
      setError("Unable to reach server. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });
    setAuthState("unauthenticated");
    setError(null);
    setBoardError(null);
    setBoardData(null);
    setChatMessages([]);
    setChatError(null);
  };

  const handleBoardChange = async (next: BoardData) => {
    setBoardData(next);
    try {
      const response = await fetch("/api/board", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });

      if (!response.ok) {
        setBoardError("Unable to save board changes.");
        return;
      }

      setBoardError(null);
    } catch {
      setBoardError("Unable to save board changes.");
    }
  };

  const handleSendChat = async (question: string) => {
    if (!boardData) {
      return;
    }

    const nextUserMessage: AIChatMessage = { role: "user", content: question };
    const nextHistory = [...chatMessages, nextUserMessage];
    setChatMessages(nextHistory);
    setChatError(null);
    setIsChatSubmitting(true);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          history: chatMessages,
        }),
      });

      if (!response.ok) {
        setChatError("AI request failed. Please try again.");
        return;
      }

      const payload = (await response.json()) as {
        assistantResponse: string;
        boardUpdated: boolean;
        board: BoardData;
      };

      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: payload.assistantResponse },
      ]);

      if (payload.boardUpdated) {
        setBoardData(payload.board);
      }
    } catch {
      setChatError("AI request failed. Please try again.");
    } finally {
      setIsChatSubmitting(false);
    }
  };

  if (authState === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--surface)] px-6">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
          Checking session...
        </p>
      </main>
    );
  }

  if (authState === "unauthenticated") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--surface)] px-6">
        <section className="w-full max-w-md rounded-3xl border border-[var(--stroke)] bg-white p-8 shadow-[var(--shadow)]">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--gray-text)]">
            Sign In Required
          </p>
          <h1 className="mt-3 font-display text-3xl font-semibold text-[var(--navy-dark)]">
            Kanban Studio
          </h1>
          <p className="mt-3 text-sm text-[var(--gray-text)]">
            Use the MVP credentials to continue.
          </p>

          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
              Username
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="mt-2 w-full rounded-xl border border-[var(--stroke)] px-3 py-2 text-base text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
                autoComplete="username"
                aria-label="Username"
              />
            </label>

            <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
              Password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-2 w-full rounded-xl border border-[var(--stroke)] px-3 py-2 text-base text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
                autoComplete="current-password"
                aria-label="Password"
              />
            </label>

            {error ? (
              <p className="text-sm font-medium text-[#cf222e]" role="alert">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-full bg-[var(--secondary-purple)] px-4 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-white transition hover:brightness-110 disabled:opacity-60"
            >
              {isSubmitting ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <p className="mt-5 text-xs text-[var(--gray-text)]">
            Demo credentials: user / password
          </p>
        </section>
      </main>
    );
  }

  if (boardError && !boardData) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--surface)] px-6">
        <section className="w-full max-w-md rounded-3xl border border-[var(--stroke)] bg-white p-8 shadow-[var(--shadow)]">
          <h1 className="font-display text-2xl font-semibold text-[var(--navy-dark)]">
            Could not load board
          </h1>
          <p className="mt-3 text-sm text-[var(--gray-text)]">{boardError}</p>
          <button
            type="button"
            onClick={() => setBoardReloadToken((prev) => prev + 1)}
            className="mt-6 rounded-full bg-[var(--secondary-purple)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white"
          >
            Retry
          </button>
        </section>
      </main>
    );
  }

  if (!boardData) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--surface)] px-6">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
          Loading board...
        </p>
      </main>
    );
  }

  return (
    <>
      {boardError ? (
        <div className="fixed left-1/2 top-6 z-50 -translate-x-1/2 rounded-full border border-[#cf222e] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#cf222e]">
          {boardError}
        </div>
      ) : null}
      <button
        type="button"
        onClick={handleLogout}
        className="fixed right-6 top-6 z-50 inline-flex items-center gap-2 rounded-full border border-[var(--stroke)] bg-white/90 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--navy-dark)] shadow-[var(--shadow)] backdrop-blur transition hover:border-[var(--primary-blue)] hover:text-[var(--primary-blue)]"
      >
        <LogoutIcon className="h-4 w-4" />
        Log out
      </button>
      <div className="lg:pr-[380px]">
        <KanbanBoard boardData={boardData} onBoardChange={handleBoardChange} />
      </div>
      <AIChatSidebar
        messages={chatMessages}
        isSubmitting={isChatSubmitting}
        error={chatError}
        onSend={handleSendChat}
      />
    </>
  );
};
