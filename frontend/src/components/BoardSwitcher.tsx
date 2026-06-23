"use client";

import { FormEvent, useState } from "react";
import type { BoardSummary } from "@/lib/api";
import { BoardIcon, ChevronDownIcon, PlusIcon, TrashIcon } from "@/components/icons";

type BoardSwitcherProps = {
  boards: BoardSummary[];
  selectedBoardId: number | null;
  onSelect: (boardId: number) => void;
  onCreate: (name: string) => void;
  onDelete: (boardId: number) => void;
};

export const BoardSwitcher = ({
  boards,
  selectedBoardId,
  onSelect,
  onCreate,
  onDelete,
}: BoardSwitcherProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [newName, setNewName] = useState("");

  const selected = boards.find((board) => board.id === selectedBoardId);

  const handleCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) {
      return;
    }
    onCreate(trimmed);
    setNewName("");
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="inline-flex items-center gap-2 rounded-full border border-[var(--stroke)] bg-white px-4 py-2 text-sm font-semibold text-[var(--navy-dark)] shadow-sm transition hover:border-[var(--primary-blue)]"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <BoardIcon className="h-4 w-4 text-[var(--primary-blue)]" />
        <span className="max-w-[200px] truncate">
          {selected ? selected.name : "Select a board"}
        </span>
        <ChevronDownIcon className="h-4 w-4 text-[var(--gray-text)]" />
      </button>

      {isOpen ? (
        <>
          <div
            className="fixed inset-0 z-30"
            onClick={() => setIsOpen(false)}
            aria-hidden
          />
          <div
            className="absolute left-0 z-40 mt-2 w-72 rounded-2xl border border-[var(--stroke)] bg-white p-2 shadow-[var(--shadow)]"
            role="listbox"
          >
            <ul className="max-h-64 space-y-1 overflow-y-auto">
              {boards.map((board) => (
                <li key={board.id}>
                  <div
                    className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm transition ${
                      board.id === selectedBoardId
                        ? "bg-[var(--surface)]"
                        : "hover:bg-[var(--surface)]"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onSelect(board.id);
                        setIsOpen(false);
                      }}
                      className="flex min-w-0 flex-1 flex-col items-start text-left"
                      role="option"
                      aria-selected={board.id === selectedBoardId}
                    >
                      <span className="w-full truncate font-semibold text-[var(--navy-dark)]">
                        {board.name}
                      </span>
                      <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--gray-text)]">
                        {board.cardCount} cards · {board.role}
                      </span>
                    </button>
                    {board.role === "owner" ? (
                      <button
                        type="button"
                        onClick={() => onDelete(board.id)}
                        aria-label={`Delete ${board.name}`}
                        title="Delete board"
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[var(--gray-text)] transition hover:bg-[rgba(207,34,46,0.1)] hover:text-[#cf222e]"
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>

            <form
              onSubmit={handleCreate}
              className="mt-2 flex items-center gap-2 border-t border-[var(--stroke)] pt-2"
            >
              <input
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                placeholder="New board name"
                aria-label="New board name"
                className="min-w-0 flex-1 rounded-xl border border-[var(--stroke)] px-3 py-2 text-sm text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
              />
              <button
                type="submit"
                aria-label="Create board"
                title="Create board"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--secondary-purple)] text-white transition hover:brightness-110"
              >
                <PlusIcon className="h-4 w-4" />
              </button>
            </form>
          </div>
        </>
      ) : null}
    </div>
  );
};
