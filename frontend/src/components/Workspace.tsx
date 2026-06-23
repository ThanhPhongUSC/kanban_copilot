"use client";

import { useEffect, useState } from "react";
import { BoardSwitcher } from "@/components/BoardSwitcher";
import { CardEditor } from "@/components/CardEditor";
import { FilterBar } from "@/components/FilterBar";
import { KanbanBoard } from "@/components/KanbanBoard";
import { RightPanel, type PanelTab } from "@/components/RightPanel";
import { LogoutIcon, SparkleIcon } from "@/components/icons";
import {
  api,
  ApiError,
  type ActivityEntry,
  type BoardDetail,
  type BoardSummary,
} from "@/lib/api";
import {
  collectAssignees,
  collectLabels,
  emptyFilter,
  type BoardData,
  type Card,
  type CardFilter,
} from "@/lib/kanban";

type WorkspaceProps = {
  username: string;
  onLogout: () => void;
};

type AIChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export const Workspace = ({ username, onLogout }: WorkspaceProps) => {
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [selectedBoardId, setSelectedBoardId] = useState<number | null>(null);
  const [detail, setDetail] = useState<BoardDetail | null>(null);
  const [boardData, setBoardData] = useState<BoardData | null>(null);
  const [nameDraft, setNameDraft] = useState("");

  const [filter, setFilter] = useState<CardFilter>(emptyFilter);
  const [panelTab, setPanelTab] = useState<PanelTab>("copilot");
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);

  const [chatMessages, setChatMessages] = useState<AIChatMessage[]>([]);
  const [chatError, setChatError] = useState<string | null>(null);
  const [isChatSubmitting, setIsChatSubmitting] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);

  const [loadError, setLoadError] = useState<string | null>(null);
  const [boardError, setBoardError] = useState<string | null>(null);

  // Load the board list once on mount.
  useEffect(() => {
    let active = true;
    api
      .listBoards()
      .then((loaded) => {
        if (!active) {
          return;
        }
        setBoards(loaded);
        setSelectedBoardId((current) => current ?? loaded[0]?.id ?? null);
      })
      .catch(() => {
        if (active) {
          setLoadError("Unable to load your boards.");
        }
      });
    return () => {
      active = false;
    };
  }, []);

  // Load the selected board's detail whenever the selection changes.
  useEffect(() => {
    if (selectedBoardId === null) {
      return;
    }
    let active = true;
    setBoardError(null);
    api
      .getBoard(selectedBoardId)
      .then((loaded) => {
        if (!active) {
          return;
        }
        setDetail(loaded);
        setBoardData(loaded.board);
        setNameDraft(loaded.name);
        setChatMessages([]);
      })
      .catch(() => {
        if (active) {
          setBoardError("Unable to load this board.");
        }
      });
    return () => {
      active = false;
    };
  }, [selectedBoardId]);

  // Refresh activity when the board changes or the activity tab opens.
  useEffect(() => {
    if (selectedBoardId === null || panelTab !== "activity") {
      return;
    }
    let active = true;
    api
      .listActivity(selectedBoardId)
      .then((loaded) => {
        if (active) {
          setActivity(loaded);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [selectedBoardId, panelTab]);

  const refreshBoardSummary = (boardId: number, next: BoardData) => {
    setBoards((prev) =>
      prev.map((board) =>
        board.id === boardId
          ? {
              ...board,
              columnCount: next.columns.length,
              cardCount: Object.keys(next.cards).length,
            }
          : board
      )
    );
  };

  const persistBoard = async (next: BoardData) => {
    if (selectedBoardId === null) {
      return;
    }
    setBoardData(next);
    refreshBoardSummary(selectedBoardId, next);
    try {
      await api.saveBoard(selectedBoardId, next);
      setBoardError(null);
    } catch {
      setBoardError("Unable to save board changes.");
    }
  };

  const handleCreateBoard = async (name: string) => {
    try {
      const created = await api.createBoard(name);
      setBoards((prev) => [
        ...prev,
        {
          id: created.boardId,
          name: created.name,
          role: created.role,
          columnCount: created.board.columns.length,
          cardCount: Object.keys(created.board.cards).length,
          updatedAt: "",
        },
      ]);
      setSelectedBoardId(created.boardId);
    } catch {
      setBoardError("Unable to create board.");
    }
  };

  const handleDeleteBoard = async (boardId: number) => {
    try {
      await api.deleteBoard(boardId);
      const remaining = boards.filter((board) => board.id !== boardId);
      setBoards(remaining);
      if (boardId === selectedBoardId) {
        setSelectedBoardId(remaining[0]?.id ?? null);
        if (remaining.length === 0) {
          setDetail(null);
          setBoardData(null);
        }
      }
    } catch {
      setBoardError("Unable to delete board.");
    }
  };

  const handleRenameBoard = async () => {
    const trimmed = nameDraft.trim();
    if (selectedBoardId === null || !trimmed || trimmed === detail?.name) {
      return;
    }
    try {
      const updated = await api.renameBoard(selectedBoardId, trimmed);
      setDetail(updated);
      setBoards((prev) =>
        prev.map((board) =>
          board.id === selectedBoardId ? { ...board, name: updated.name } : board
        )
      );
    } catch {
      setBoardError("Unable to rename board.");
    }
  };

  const handleSaveCard = async (card: Card) => {
    if (!boardData) {
      return;
    }
    const next: BoardData = {
      ...boardData,
      cards: { ...boardData.cards, [card.id]: card },
    };
    setEditingCardId(null);
    await persistBoard(next);
  };

  const handleAddMember = async (member: string) => {
    if (selectedBoardId === null) {
      return;
    }
    setMembersError(null);
    try {
      const members = await api.addMember(selectedBoardId, member);
      setDetail((prev) => (prev ? { ...prev, members } : prev));
    } catch (caught) {
      setMembersError(
        caught instanceof ApiError ? caught.message : "Unable to add member."
      );
    }
  };

  const handleRemoveMember = async (member: string) => {
    if (selectedBoardId === null) {
      return;
    }
    setMembersError(null);
    try {
      const members = await api.removeMember(selectedBoardId, member);
      setDetail((prev) => (prev ? { ...prev, members } : prev));
    } catch {
      setMembersError("Unable to remove member.");
    }
  };

  const handleSendChat = async (question: string) => {
    if (selectedBoardId === null) {
      return;
    }
    const history = chatMessages.map((message) => ({
      role: message.role,
      content: message.content,
    }));
    setChatMessages((prev) => [...prev, { role: "user", content: question }]);
    setChatError(null);
    setIsChatSubmitting(true);
    try {
      const result = await api.sendChat(selectedBoardId, question, history);
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: result.assistantResponse },
      ]);
      if (result.boardUpdated) {
        setBoardData(result.board);
        refreshBoardSummary(selectedBoardId, result.board);
      }
    } catch {
      setChatError("AI request failed. Please try again.");
    } finally {
      setIsChatSubmitting(false);
    }
  };

  const editingCard =
    editingCardId && boardData ? boardData.cards[editingCardId] : null;

  return (
    <>
      <button
        type="button"
        onClick={onLogout}
        className="fixed right-6 top-6 z-50 inline-flex items-center gap-2 rounded-full border border-[var(--stroke)] bg-white/90 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--navy-dark)] shadow-[var(--shadow)] backdrop-blur transition hover:border-[var(--primary-blue)] hover:text-[var(--primary-blue)]"
      >
        <LogoutIcon className="h-4 w-4" />
        Log out
      </button>

      <div className={isPanelOpen ? "lg:pr-[380px]" : ""}>
        <main className="relative mx-auto flex min-h-screen w-full max-w-[1700px] flex-col gap-6 px-6 pb-16 pt-8">
          <header className="flex flex-col gap-4 rounded-[28px] border border-[var(--stroke)] bg-white/80 p-6 shadow-[var(--shadow)] backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-[var(--gray-text)]">
                  Signed in as {username}
                </p>
                {detail ? (
                  <input
                    value={nameDraft}
                    onChange={(event) => setNameDraft(event.target.value)}
                    onBlur={handleRenameBoard}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.currentTarget.blur();
                      }
                    }}
                    aria-label="Board name"
                    className="mt-1 w-full max-w-md bg-transparent font-display text-3xl font-semibold text-[var(--navy-dark)] outline-none"
                  />
                ) : (
                  <h1 className="mt-1 font-display text-3xl font-semibold text-[var(--navy-dark)]">
                    Kanban Studio
                  </h1>
                )}
              </div>
              <div className="flex items-center gap-3">
                <BoardSwitcher
                  boards={boards}
                  selectedBoardId={selectedBoardId}
                  onSelect={setSelectedBoardId}
                  onCreate={handleCreateBoard}
                  onDelete={handleDeleteBoard}
                />
              </div>
            </div>
            {boardData ? (
              <FilterBar
                filter={filter}
                labels={collectLabels(boardData.cards)}
                assignees={collectAssignees(boardData.cards)}
                onChange={setFilter}
              />
            ) : null}
          </header>

          {boardError ? (
            <div className="rounded-2xl border border-[#cf222e] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#cf222e]">
              {boardError}
            </div>
          ) : null}

          {loadError ? (
            <p className="text-sm text-[var(--gray-text)]">{loadError}</p>
          ) : null}

          {boardData && detail ? (
            <KanbanBoard
              key={detail.boardId}
              boardData={boardData}
              onBoardChange={persistBoard}
              onEditCard={setEditingCardId}
              filter={filter}
            />
          ) : boards.length === 0 && !loadError ? (
            <p className="text-sm text-[var(--gray-text)]">
              You have no boards yet. Create one to get started.
            </p>
          ) : (
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
              Loading board...
            </p>
          )}
        </main>
      </div>

      {isPanelOpen ? (
        <RightPanel
          tab={panelTab}
          onTabChange={setPanelTab}
          onClose={() => setIsPanelOpen(false)}
          messages={chatMessages}
          isChatSubmitting={isChatSubmitting}
          chatError={chatError}
          onSendChat={handleSendChat}
          members={detail?.members ?? []}
          canManageMembers={detail?.role === "owner"}
          membersError={membersError}
          onAddMember={handleAddMember}
          onRemoveMember={handleRemoveMember}
          activity={activity}
        />
      ) : (
        <button
          type="button"
          onClick={() => setIsPanelOpen(true)}
          aria-label="Open assistant panel"
          className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-2 rounded-full bg-[var(--secondary-purple)] px-5 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-white shadow-[0_20px_40px_rgba(3,33,71,0.18)] transition hover:brightness-110"
        >
          <SparkleIcon className="h-4 w-4" />
          Copilot
        </button>
      )}

      {editingCard && detail ? (
        <CardEditor
          boardId={detail.boardId}
          card={editingCard}
          memberUsernames={detail.members.map((member) => member.username)}
          onSave={handleSaveCard}
          onClose={() => setEditingCardId(null)}
        />
      ) : null}
    </>
  );
};
