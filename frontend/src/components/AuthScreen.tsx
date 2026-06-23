"use client";

import { FormEvent, useState } from "react";
import { api, ApiError } from "@/lib/api";

type AuthScreenProps = {
  onAuthenticated: () => void;
};

type Mode = "login" | "register";

export const AuthScreen = ({ onAuthenticated }: AuthScreenProps) => {
  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isLogin = mode === "login";

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      if (isLogin) {
        await api.login(username, password);
      } else {
        await api.register(username, password);
      }
      onAuthenticated();
    } catch (caught) {
      if (caught instanceof ApiError) {
        if (isLogin && caught.status === 401) {
          setError("Incorrect username or password.");
        } else {
          setError(caught.message);
        }
      } else {
        setError("Unable to reach server. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--surface)] px-6">
      <section className="w-full max-w-md rounded-3xl border border-[var(--stroke)] bg-white p-8 shadow-[var(--shadow)]">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--gray-text)]">
          {isLogin ? "Welcome Back" : "Create Account"}
        </p>
        <h1 className="mt-3 font-display text-3xl font-semibold text-[var(--navy-dark)]">
          Kanban Studio
        </h1>
        <p className="mt-3 text-sm text-[var(--gray-text)]">
          {isLogin
            ? "Sign in to your boards."
            : "Register to start organizing your projects."}
        </p>

        <div className="mt-6 grid grid-cols-2 gap-2 rounded-full bg-[var(--surface)] p-1">
          <button
            type="button"
            onClick={() => switchMode("login")}
            className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition ${
              isLogin
                ? "bg-[var(--secondary-purple)] text-white"
                : "text-[var(--gray-text)]"
            }`}
          >
            Log in
          </button>
          <button
            type="button"
            onClick={() => switchMode("register")}
            className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition ${
              !isLogin
                ? "bg-[var(--secondary-purple)] text-white"
                : "text-[var(--gray-text)]"
            }`}
          >
            Sign up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
            Username
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="mt-2 w-full rounded-xl border border-[var(--stroke)] px-3 py-2 text-base text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
              autoComplete="username"
              aria-label="Username"
              required
            />
          </label>

          <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 w-full rounded-xl border border-[var(--stroke)] px-3 py-2 text-base text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
              autoComplete={isLogin ? "current-password" : "new-password"}
              aria-label="Password"
              required
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
            {isSubmitting
              ? isLogin
                ? "Signing in..."
                : "Creating..."
              : isLogin
                ? "Sign in"
                : "Create account"}
          </button>
        </form>

        <p className="mt-5 text-xs text-[var(--gray-text)]">
          Demo credentials: user / password
        </p>
      </section>
    </main>
  );
};
