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
  cardMatchesFilter,
  createId,
  emptyFilter,
  initialData,
  moveCard,
  type BoardData,
  type Card,
  type CardFilter,
} from "@/lib/kanban";

type KanbanBoardProps = {
  boardData?: BoardData;
  onBoardChange?: (next: BoardData) => void | Promise<void>;
  onEditCard?: (cardId: string) => void;
  filter?: CardFilter;
};

export const KanbanBoard = ({
  boardData,
  onBoardChange,
  onEditCard,
  filter = emptyFilter,
}: KanbanBoardProps) => {
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
    updateBoard((prev) => ({
      ...prev,
      cards: Object.fromEntries(
        Object.entries(prev.cards).filter(([id]) => id !== cardId)
      ),
      columns: prev.columns.map((column) =>
        column.id === columnId
          ? { ...column, cardIds: column.cardIds.filter((id) => id !== cardId) }
          : column
      ),
    }));
  };

  const activeCard = activeCardId ? cardsById[activeCardId] : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        {board.columns.map((column) => (
          <KanbanColumn
            key={column.id}
            column={column}
            cards={column.cardIds
              .map((cardId) => board.cards[cardId])
              .filter((card): card is Card => Boolean(card))
              .filter((card) => cardMatchesFilter(card, filter))}
            onRename={handleRenameColumn}
            onAddCard={handleAddCard}
            onDeleteCard={handleDeleteCard}
            onEditCard={(cardId) => onEditCard?.(cardId)}
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
  );
};
