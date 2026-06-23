"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { KanbanColumn } from "@/components/KanbanColumn";
import { KanbanCardPreview } from "@/components/KanbanCardPreview";
import {
  createId,
  initialData,
  moveCard,
  type BoardData,
  type Card,
} from "@/lib/kanban";

type KanbanBoardProps = {
  boardData?: BoardData;
  onBoardChange?: (next: BoardData) => void | Promise<void>;
};

export const KanbanBoard = ({ boardData, onBoardChange }: KanbanBoardProps) => {
  const [board, setBoard] = useState<BoardData>(() => boardData ?? initialData);
  const [syncedBoardData, setSyncedBoardData] = useState(boardData);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);

  // Sync local board when the parent supplies new board data (load or AI update).
  if (boardData && boardData !== syncedBoardData) {
    setSyncedBoardData(boardData);
    setBoard(boardData);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  const cardsById = useMemo(() => board.cards, [board.cards]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveCardId(event.active.id as string);
  };

  const updateBoard = (updater: (prev: BoardData) => BoardData) => {
    setBoard((prev) => {
      const next = updater(prev);
      void onBoardChange?.(next);
      return next;
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCardId(null);

    if (!over || active.id === over.id) {
      return;
    }

    updateBoard((prev) => ({
      ...prev,
      columns: moveCard(prev.columns, active.id as string, over.id as string),
    }));
  };

  const handleRenameColumn = (columnId: string, title: string) => {
    updateBoard((prev) => ({
      ...prev,
      columns: prev.columns.map((column) =>
        column.id === columnId ? { ...column, title } : column
      ),
    }));
  };

  const handleAddCard = (columnId: string, title: string, details: string) => {
    const id = createId("card");
    updateBoard((prev) => ({
      ...prev,
      cards: {
        ...prev.cards,
        [id]: { id, title, details: details || "No details yet." },
      },
      columns: prev.columns.map((column) =>
        column.id === columnId
          ? { ...column, cardIds: [...column.cardIds, id] }
          : column
      ),
    }));
  };

  const handleDeleteCard = (columnId: string, cardId: string) => {
    updateBoard((prev) => {
      return {
        ...prev,
        cards: Object.fromEntries(
          Object.entries(prev.cards).filter(([id]) => id !== cardId)
        ),
        columns: prev.columns.map((column) =>
          column.id === columnId
            ? {
                ...column,
                cardIds: column.cardIds.filter((id) => id !== cardId),
              }
            : column
        ),
      };
    });
  };

  const activeCard = activeCardId ? cardsById[activeCardId] : null;
  const totalCards = Object.keys(board.cards).length;

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute left-0 top-0 h-[420px] w-[420px] -translate-x-1/3 -translate-y-1/3 rounded-full bg-[radial-gradient(circle,_rgba(32,157,215,0.25)_0%,_rgba(32,157,215,0.05)_55%,_transparent_70%)]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[520px] w-[520px] translate-x-1/4 translate-y-1/4 rounded-full bg-[radial-gradient(circle,_rgba(117,57,145,0.18)_0%,_rgba(117,57,145,0.05)_55%,_transparent_75%)]" />

      <main className="relative mx-auto flex min-h-screen w-full max-w-[1700px] flex-col gap-6 px-6 pb-16 pt-8">
        <header className="flex flex-col gap-4 rounded-[28px] border border-[var(--stroke)] bg-white/80 p-6 shadow-[var(--shadow)] backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-[var(--gray-text)]">
                Single Board Kanban
              </p>
              <h1 className="mt-1 font-display text-3xl font-semibold text-[var(--navy-dark)]">
                Kanban Studio
              </h1>
            </div>
            <div className="flex items-stretch gap-3">
              <div className="rounded-2xl border border-[var(--stroke)] bg-[var(--surface)] px-5 py-2.5 text-center">
                <p className="font-display text-2xl font-semibold leading-none text-[var(--primary-blue)]">
                  {board.columns.length}
                </p>
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
                  Columns
                </p>
              </div>
              <div className="rounded-2xl border border-[var(--stroke)] bg-[var(--surface)] px-5 py-2.5 text-center">
                <p className="font-display text-2xl font-semibold leading-none text-[var(--secondary-purple)]">
                  {totalCards}
                </p>
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
                  Cards
                </p>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            {board.columns.map((column) => (
              <div
                key={column.id}
                className="flex min-w-0 flex-1 basis-0 items-center justify-between gap-2 rounded-xl border border-[var(--stroke)] bg-[var(--surface)] px-3 py-2"
              >
                <span className="flex min-w-0 items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-[var(--navy-dark)]">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--accent-yellow)]" />
                  <span className="truncate">{column.title}</span>
                </span>
                <span className="shrink-0 text-xs font-semibold tabular-nums text-[var(--gray-text)]">
                  {column.cardIds.length}
                </span>
              </div>
            ))}
          </div>
        </header>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
            {board.columns.map((column) => (
              <KanbanColumn
                key={column.id}
                column={column}
                cards={column.cardIds
                  .map((cardId) => board.cards[cardId])
                  .filter((card): card is Card => Boolean(card))}
                onRename={handleRenameColumn}
                onAddCard={handleAddCard}
                onDeleteCard={handleDeleteCard}
              />
            ))}
          </section>
          <DragOverlay>
            {activeCard ? (
              <div className="w-[260px]">
                <KanbanCardPreview card={activeCard} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </main>
    </div>
  );
};
