"use client";

import type { CardFilter, Priority } from "@/lib/kanban";
import { isFilterActive } from "@/lib/kanban";
import { FilterIcon } from "@/components/icons";

type FilterBarProps = {
  filter: CardFilter;
  labels: string[];
  assignees: string[];
  onChange: (filter: CardFilter) => void;
};

const selectClass =
  "rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-sm text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]";

export const FilterBar = ({
  filter,
  labels,
  assignees,
  onChange,
}: FilterBarProps) => {
  const update = (patch: Partial<CardFilter>) =>
    onChange({ ...filter, ...patch });

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--stroke)] bg-white/80 px-4 py-3">
      <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
        <FilterIcon className="h-4 w-4 text-[var(--primary-blue)]" />
        Filters
      </span>
      <input
        value={filter.text}
        onChange={(event) => update({ text: event.target.value })}
        placeholder="Search cards"
        aria-label="Search cards"
        className={`${selectClass} min-w-[160px] flex-1`}
      />
      <select
        value={filter.priority}
        onChange={(event) =>
          update({ priority: event.target.value as Priority | "all" })
        }
        aria-label="Filter by priority"
        className={selectClass}
      >
        <option value="all">All priorities</option>
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
      </select>
      <select
        value={filter.label}
        onChange={(event) => update({ label: event.target.value })}
        aria-label="Filter by label"
        className={selectClass}
      >
        <option value="">All labels</option>
        {labels.map((label) => (
          <option key={label} value={label}>
            {label}
          </option>
        ))}
      </select>
      <select
        value={filter.assignee}
        onChange={(event) => update({ assignee: event.target.value })}
        aria-label="Filter by assignee"
        className={selectClass}
      >
        <option value="">All assignees</option>
        {assignees.map((assignee) => (
          <option key={assignee} value={assignee}>
            {assignee}
          </option>
        ))}
      </select>
      {isFilterActive(filter) ? (
        <button
          type="button"
          onClick={() =>
            onChange({ text: "", priority: "all", label: "", assignee: "" })
          }
          className="rounded-full border border-[var(--stroke)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-[var(--gray-text)] transition hover:text-[var(--navy-dark)]"
        >
          Clear
        </button>
      ) : null}
    </div>
  );
};
