import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import clsx from "clsx";
import type { Card, Priority } from "@/lib/kanban";
import { EditIcon, TrashIcon } from "@/components/icons";

type KanbanCardProps = {
  card: Card;
  onDelete: (cardId: string) => void;
  onEdit: (cardId: string) => void;
};

const priorityStyles: Record<Priority, string> = {
  high: "bg-[rgba(207,34,46,0.12)] text-[#cf222e]",
  medium: "bg-[rgba(236,173,10,0.16)] text-[#9a6f00]",
  low: "bg-[rgba(32,157,215,0.12)] text-[var(--primary-blue)]",
};

const formatDueDate = (value: string): string => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

export const KanbanCard = ({ card, onDelete, onEdit }: KanbanCardProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const labels = card.labels ?? [];

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={clsx(
        "group relative cursor-grab rounded-2xl border border-transparent bg-white px-4 py-4 shadow-[0_12px_24px_rgba(3,33,71,0.08)]",
        "transition-all duration-150 hover:border-[var(--stroke)] active:cursor-grabbing",
        isDragging && "opacity-60 shadow-[0_18px_32px_rgba(3,33,71,0.16)]"
      )}
      {...attributes}
      {...listeners}
      data-testid={`card-${card.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="font-display text-base font-semibold text-[var(--navy-dark)]">
            {card.title}
          </h4>
          <p className="mt-2 line-clamp-3 text-sm leading-6 text-[var(--gray-text)]">
            {card.details}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1 opacity-0 transition focus-within:opacity-100 group-hover:opacity-100">
          <button
            type="button"
            onClick={() => onEdit(card.id)}
            onPointerDown={(event) => event.stopPropagation()}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--gray-text)] transition hover:bg-[rgba(32,157,215,0.1)] hover:text-[var(--primary-blue)]"
            aria-label={`Edit ${card.title}`}
            title="Edit card"
          >
            <EditIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(card.id)}
            onPointerDown={(event) => event.stopPropagation()}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--gray-text)] transition hover:bg-[rgba(207,34,46,0.1)] hover:text-[#cf222e]"
            aria-label={`Delete ${card.title}`}
            title="Delete card"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {card.priority || card.dueDate || card.assignee || labels.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {card.priority ? (
            <span
              className={clsx(
                "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em]",
                priorityStyles[card.priority]
              )}
            >
              {card.priority}
            </span>
          ) : null}
          {card.dueDate ? (
            <span className="rounded-full bg-[var(--surface)] px-2 py-0.5 text-[10px] font-semibold tabular-nums text-[var(--gray-text)]">
              {formatDueDate(card.dueDate)}
            </span>
          ) : null}
          {labels.map((label) => (
            <span
              key={label}
              className="rounded-full bg-[rgba(117,57,145,0.1)] px-2 py-0.5 text-[10px] font-semibold text-[var(--secondary-purple)]"
            >
              {label}
            </span>
          ))}
          {card.assignee ? (
            <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-[var(--navy-dark)] px-2 py-0.5 text-[10px] font-semibold text-white">
              {card.assignee}
            </span>
          ) : null}
        </div>
      ) : null}
    </article>
  );
};
