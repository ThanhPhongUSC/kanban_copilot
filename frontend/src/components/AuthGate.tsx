"use client";

import { useEffect, useState } from "react";
import { AuthScreen } from "@/components/AuthScreen";
import { Workspace } from "@/components/Workspace";
import { api } from "@/lib/api";

type AuthState = "loading" | "authenticated" | "unauthenticated";

export const AuthGate = () => {
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [username, setUsername] = useState("");

  useEffect(() => {
    let active = true;
    api
      .getSession()
      .then((session) => {
        if (active) {
          setUsername(session.user);
          setAuthState("authenticated");
        }
      })
      .catch(() => {
        if (active) {
          setAuthState("unauthenticated");
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const handleAuthenticated = async () => {
    try {
      const session = await api.getSession();
      setUsername(session.user);
    } catch {
      // Cookie is set on success; fall back to a generic label if the
      // follow-up session read fails for any reason.
      setUsername((current) => current || "you");
    }
    setAuthState("authenticated");
  };

  const handleLogout = async () => {
    try {
      await api.logout();
    } finally {
      setAuthState("unauthenticated");
      setUsername("");
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
    return <AuthScreen onAuthenticated={handleAuthenticated} />;
  }

  return <Workspace username={username} onLogout={handleLogout} />;
};
