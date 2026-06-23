"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { SendIcon, SparkleIcon } from "@/components/icons";

type AIChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type AIChatSidebarProps = {
  messages: AIChatMessage[];
  isSubmitting: boolean;
  error: string | null;
  onSend: (message: string) => Promise<void>;
};

export const AIChatSidebar = ({
  messages,
  isSubmitting,
  error,
  onSend,
}: AIChatSidebarProps) => {
  const [draft, setDraft] = useState("");
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const thread = threadRef.current;
    if (thread) {
      thread.scrollTop = thread.scrollHeight;
    }
  }, [messages, isSubmitting]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = draft.trim();
    if (!next) {
      return;
    }

    setDraft("");
    await onSend(next);
  };

  return (
    <aside className="fixed bottom-4 right-4 top-20 z-40 flex w-[340px] flex-col rounded-3xl border border-[var(--stroke)] bg-white/95 p-4 shadow-[0_20px_40px_rgba(3,33,71,0.14)] backdrop-blur lg:w-[360px]" data-testid="ai-chat-sidebar">
      <div className="rounded-2xl border border-[var(--stroke)] bg-[var(--surface)] p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--secondary-purple)] text-white">
            <SparkleIcon className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[var(--gray-text)]">
              AI Assistant
            </p>
            <h2 className="font-display text-xl font-semibold text-[var(--navy-dark)]">
              Board Copilot
            </h2>
          </div>
        </div>
        <p className="mt-3 text-xs leading-5 text-[var(--gray-text)]">
          Ask for planning help. The assistant can reply and optionally update the board.
        </p>
      </div>

      <div ref={threadRef} className="mt-4 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
        {messages.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--stroke)] p-4 text-sm text-[var(--gray-text)]">
            {'Start a chat with a question like "What should we prioritize this week?"'}
          </div>
        ) : null}
        {messages.map((message, index) => (
          <article
            key={`${message.role}-${index}`}
            className={
              message.role === "assistant"
                ? "rounded-2xl border border-[var(--stroke)] bg-[var(--surface)] p-3"
                : "ml-6 rounded-2xl bg-[var(--secondary-purple)] p-3 text-white"
            }
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] opacity-80">
              {message.role === "assistant" ? "Assistant" : "You"}
            </p>
            <p className="mt-2 text-sm leading-6">{message.content}</p>
          </article>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Ask the assistant..."
          rows={3}
          className="w-full resize-none rounded-2xl border border-[var(--stroke)] px-3 py-2 text-sm text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
          aria-label="AI chat input"
        />
        {error ? (
          <p className="text-xs font-semibold text-[#cf222e]" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={isSubmitting}
          data-testid="ai-chat-send"
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--secondary-purple)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:brightness-110 disabled:opacity-60"
        >
          <SendIcon className="h-4 w-4" />
          {isSubmitting ? "Thinking..." : "Send"}
        </button>
      </form>
    </aside>
  );
};
