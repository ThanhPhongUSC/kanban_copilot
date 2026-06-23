"use client";

import { FormEvent, useEffect, useState } from "react";
import { api, type CommentInfo } from "@/lib/api";
import type { Card, Priority } from "@/lib/kanban";
import { CloseIcon } from "@/components/icons";

type CardEditorProps = {
  boardId: number;
  card: Card;
  memberUsernames: string[];
  onSave: (card: Card) => void;
  onClose: () => void;
};

const fieldClass =
  "mt-1 w-full rounded-xl border border-[var(--stroke)] px-3 py-2 text-sm text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]";

const labelClass =
  "block text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]";

export const CardEditor = ({
  boardId,
  card,
  memberUsernames,
  onSave,
  onClose,
}: CardEditorProps) => {
  const [title, setTitle] = useState(card.title);
  const [details, setDetails] = useState(card.details);
  const [priority, setPriority] = useState<Priority | "">(card.priority ?? "");
  const [dueDate, setDueDate] = useState(card.dueDate ?? "");
  const [labels, setLabels] = useState((card.labels ?? []).join(", "));
  const [assignee, setAssignee] = useState(card.assignee ?? "");

  const [comments, setComments] = useState<CommentInfo[]>([]);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentError, setCommentError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api
      .listComments(boardId, card.id)
      .then((loaded) => {
        if (active) {
          setComments(loaded);
        }
      })
      .catch(() => {
        if (active) {
          setCommentError("Unable to load comments.");
        }
      });
    return () => {
      active = false;
    };
  }, [boardId, card.id]);

  const handleSave = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim()) {
      return;
    }
    onSave({
      ...card,
      title: title.trim(),
      details: details.trim(),
      priority: priority || null,
      dueDate: dueDate || null,
      labels: labels
        .split(",")
        .map((label) => label.trim())
        .filter(Boolean),
      assignee: assignee || null,
    });
  };

  const handleAddComment = async () => {
    const body = commentDraft.trim();
    if (!body) {
      return;
    }
    setCommentError(null);
    try {
      const updated = await api.addComment(boardId, card.id, body);
      setComments(updated);
      setCommentDraft("");
    } catch {
      setCommentError("Unable to add comment.");
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Edit card"
    >
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-[var(--stroke)] bg-white shadow-[var(--shadow)]">
        <div className="flex items-center justify-between border-b border-[var(--stroke)] px-6 py-4">
          <h2 className="font-display text-xl font-semibold text-[var(--navy-dark)]">
            Edit card
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close editor"
            className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--gray-text)] transition hover:bg-[var(--surface)]"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <form id="card-editor-form" onSubmit={handleSave} className="space-y-4">
            <label className={labelClass}>
              Title
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className={fieldClass}
                aria-label="Card title"
                required
              />
            </label>
            <label className={labelClass}>
              Details
              <textarea
                value={details}
                onChange={(event) => setDetails(event.target.value)}
                rows={3}
                className={`${fieldClass} resize-none`}
                aria-label="Card details"
              />
            </label>
            <div className="grid grid-cols-2 gap-4">
              <label className={labelClass}>
                Priority
                <select
                  value={priority}
                  onChange={(event) =>
                    setPriority(event.target.value as Priority | "")
                  }
                  className={fieldClass}
                  aria-label="Card priority"
                >
                  <option value="">None</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </label>
              <label className={labelClass}>
                Due date
                <input
                  type="date"
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                  className={fieldClass}
                  aria-label="Card due date"
                />
              </label>
            </div>
            <label className={labelClass}>
              Labels (comma separated)
              <input
                value={labels}
                onChange={(event) => setLabels(event.target.value)}
                placeholder="design, urgent"
                className={fieldClass}
                aria-label="Card labels"
              />
            </label>
            <label className={labelClass}>
              Assignee
              <input
                value={assignee}
                onChange={(event) => setAssignee(event.target.value)}
                list="card-editor-members"
                placeholder="username"
                className={fieldClass}
                aria-label="Card assignee"
              />
              <datalist id="card-editor-members">
                {memberUsernames.map((member) => (
                  <option key={member} value={member} />
                ))}
              </datalist>
            </label>
          </form>

          <div className="mt-6 border-t border-[var(--stroke)] pt-4">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
              Comments
            </h3>
            <div className="mt-3 space-y-3">
              {comments.length === 0 ? (
                <p className="text-sm text-[var(--gray-text)]">No comments yet.</p>
              ) : (
                comments.map((comment) => (
                  <div
                    key={comment.id}
                    className="rounded-2xl border border-[var(--stroke)] bg-[var(--surface)] p-3"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[var(--gray-text)]">
                      {comment.username}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-[var(--navy-dark)]">
                      {comment.body}
                    </p>
                  </div>
                ))
              )}
            </div>
            {commentError ? (
              <p className="mt-2 text-xs font-semibold text-[#cf222e]" role="alert">
                {commentError}
              </p>
            ) : null}
            <div className="mt-3 flex items-end gap-2">
              <textarea
                value={commentDraft}
                onChange={(event) => setCommentDraft(event.target.value)}
                rows={2}
                placeholder="Add a comment"
                aria-label="New comment"
                className={`${fieldClass} resize-none`}
              />
              <button
                type="button"
                onClick={handleAddComment}
                className="shrink-0 rounded-full bg-[var(--primary-blue)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-white transition hover:brightness-110"
              >
                Post
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[var(--stroke)] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[var(--stroke)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-[var(--gray-text)] transition hover:text-[var(--navy-dark)]"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="card-editor-form"
            className="rounded-full bg-[var(--secondary-purple)] px-5 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-white transition hover:brightness-110"
          >
            Save changes
          </button>
        </div>
      </div>
    </div>
  );
};
