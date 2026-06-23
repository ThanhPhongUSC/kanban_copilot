"use client";

import type { ActivityEntry } from "@/lib/api";
import { HistoryIcon } from "@/components/icons";

type ActivityFeedProps = {
  activity: ActivityEntry[];
};

const ACTION_LABELS: Record<string, string> = {
  created_board: "created the board",
  renamed_board: "renamed the board",
  added_member: "shared the board with",
  removed_member: "removed",
  commented: "commented on",
  ai_updated_board: "used AI to update the board",
};

const describe = (entry: ActivityEntry): string => {
  const verb = ACTION_LABELS[entry.action] ?? entry.action.replace(/_/g, " ");
  return entry.detail ? `${verb} ${entry.detail}` : verb;
};

export const ActivityFeed = ({ activity }: ActivityFeedProps) => {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-[var(--gray-text)]">
        <HistoryIcon className="h-4 w-4 text-[var(--primary-blue)]" />
        Activity
      </div>

      <ul className="mt-4 flex-1 space-y-2 overflow-y-auto">
        {activity.length === 0 ? (
          <li className="rounded-2xl border border-dashed border-[var(--stroke)] p-4 text-sm text-[var(--gray-text)]">
            No activity yet.
          </li>
        ) : (
          activity.map((entry) => (
            <li
              key={entry.id}
              className="rounded-2xl border border-[var(--stroke)] bg-[var(--surface)] px-3 py-2 text-sm leading-6 text-[var(--navy-dark)]"
            >
              <span className="font-semibold">{entry.username}</span>{" "}
              {describe(entry)}
            </li>
          ))
        )}
      </ul>
    </div>
  );
};
