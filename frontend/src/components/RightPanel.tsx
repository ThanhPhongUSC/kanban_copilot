"use client";

import { AIChatSidebar } from "@/components/AIChatSidebar";
import { ActivityFeed } from "@/components/ActivityFeed";
import { MembersPanel } from "@/components/MembersPanel";
import type { ActivityEntry, MemberInfo } from "@/lib/api";
import { CloseIcon, HistoryIcon, SparkleIcon, UsersIcon } from "@/components/icons";

export type PanelTab = "copilot" | "members" | "activity";

type AIChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type RightPanelProps = {
  tab: PanelTab;
  onTabChange: (tab: PanelTab) => void;
  onClose: () => void;
  messages: AIChatMessage[];
  isChatSubmitting: boolean;
  chatError: string | null;
  onSendChat: (message: string) => Promise<void>;
  members: MemberInfo[];
  canManageMembers: boolean;
  membersError: string | null;
  onAddMember: (username: string) => void;
  onRemoveMember: (username: string) => void;
  activity: ActivityEntry[];
};

const TABS: { id: PanelTab; label: string; Icon: typeof SparkleIcon }[] = [
  { id: "copilot", label: "Copilot", Icon: SparkleIcon },
  { id: "members", label: "Members", Icon: UsersIcon },
  { id: "activity", label: "Activity", Icon: HistoryIcon },
];

export const RightPanel = ({
  tab,
  onTabChange,
  onClose,
  messages,
  isChatSubmitting,
  chatError,
  onSendChat,
  members,
  canManageMembers,
  membersError,
  onAddMember,
  onRemoveMember,
  activity,
}: RightPanelProps) => {
  return (
    <aside className="fixed bottom-4 right-4 top-20 z-40 flex w-[340px] flex-col rounded-3xl border border-[var(--stroke)] bg-white/95 p-4 shadow-[0_20px_40px_rgba(3,33,71,0.14)] backdrop-blur lg:w-[360px]">
      <div className="mb-3 flex justify-end">
        <button
          type="button"
          onClick={onClose}
          aria-label="Hide assistant panel"
          title="Hide panel"
          className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--gray-text)] transition hover:bg-[var(--surface)] hover:text-[var(--navy-dark)]"
        >
          <CloseIcon className="h-5 w-5" />
        </button>
      </div>
      <div className="mb-4 grid grid-cols-3 gap-1 rounded-full bg-[var(--surface)] p-1">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onTabChange(id)}
            aria-pressed={tab === id}
            className={`inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] transition ${
              tab === id
                ? "bg-[var(--secondary-purple)] text-white"
                : "text-[var(--gray-text)]"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === "copilot" ? (
        <AIChatSidebar
          messages={messages}
          isSubmitting={isChatSubmitting}
          error={chatError}
          onSend={onSendChat}
        />
      ) : null}
      {tab === "members" ? (
        <MembersPanel
          members={members}
          canManage={canManageMembers}
          error={membersError}
          onAdd={onAddMember}
          onRemove={onRemoveMember}
        />
      ) : null}
      {tab === "activity" ? <ActivityFeed activity={activity} /> : null}
    </aside>
  );
};
