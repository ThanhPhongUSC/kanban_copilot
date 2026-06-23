"use client";

import { FormEvent, useState } from "react";
import type { MemberInfo } from "@/lib/api";
import { TrashIcon, UsersIcon } from "@/components/icons";

type MembersPanelProps = {
  members: MemberInfo[];
  canManage: boolean;
  error: string | null;
  onAdd: (username: string) => void;
  onRemove: (username: string) => void;
};

export const MembersPanel = ({
  members,
  canManage,
  error,
  onAdd,
  onRemove,
}: MembersPanelProps) => {
  const [username, setUsername] = useState("");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = username.trim();
    if (!trimmed) {
      return;
    }
    onAdd(trimmed);
    setUsername("");
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-[var(--gray-text)]">
        <UsersIcon className="h-4 w-4 text-[var(--primary-blue)]" />
        Members
      </div>

      <ul className="mt-4 flex-1 space-y-2 overflow-y-auto">
        {members.map((member) => (
          <li
            key={member.username}
            className="flex items-center justify-between gap-2 rounded-2xl border border-[var(--stroke)] bg-[var(--surface)] px-3 py-2"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[var(--navy-dark)]">
                {member.username}
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--gray-text)]">
                {member.role}
              </p>
            </div>
            {canManage && member.role !== "owner" ? (
              <button
                type="button"
                onClick={() => onRemove(member.username)}
                aria-label={`Remove ${member.username}`}
                title="Remove member"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[var(--gray-text)] transition hover:bg-[rgba(207,34,46,0.1)] hover:text-[#cf222e]"
              >
                <TrashIcon className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </li>
        ))}
      </ul>

      {error ? (
        <p className="mt-2 text-xs font-semibold text-[#cf222e]" role="alert">
          {error}
        </p>
      ) : null}

      {canManage ? (
        <form onSubmit={handleSubmit} className="mt-3 flex items-center gap-2">
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="Invite by username"
            aria-label="Invite by username"
            className="min-w-0 flex-1 rounded-xl border border-[var(--stroke)] px-3 py-2 text-sm text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
          />
          <button
            type="submit"
            className="shrink-0 rounded-full bg-[var(--secondary-purple)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-white transition hover:brightness-110"
          >
            Add
          </button>
        </form>
      ) : (
        <p className="mt-3 text-xs text-[var(--gray-text)]">
          Only the board owner can manage members.
        </p>
      )}
    </div>
  );
};
