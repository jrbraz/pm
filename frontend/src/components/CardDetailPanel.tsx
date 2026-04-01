"use client";

import { useEffect, useRef, useState } from "react";
import { ChecklistSection } from "@/components/ChecklistSection";
import { CommentsSection } from "@/components/CommentsSection";
import { ActivityFeed } from "@/components/ActivityFeed";
import { fetchBoardActivity } from "@/lib/api";
import { PRIORITY_COLORS, PRIORITY_LABELS, type ActivityEntry, type Card, type ChecklistItem, type Priority } from "@/lib/kanban";
import { useAuth } from "@/components/AuthContext";

type Tab = "details" | "checklist" | "comments" | "activity";

type CardDetailPanelProps = {
  card: Card;
  columnTitle: string;
  username: string;
  boardId: number;
  boardMembers?: string[];
  onSave: (updated: Card) => void;
  onClose: () => void;
};

const PRIORITIES: Priority[] = ["critical", "high", "medium", "low"];

export const CardDetailPanel = ({
  card,
  columnTitle,
  username,
  boardId,
  boardMembers = [],
  onSave,
  onClose,
}: CardDetailPanelProps) => {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("details");

  // Details state
  const [title, setTitle] = useState(card.title);
  const [details, setDetails] = useState(card.details);
  const [priority, setPriority] = useState<Priority | null | undefined>(card.priority);
  const [labelsStr, setLabelsStr] = useState((card.labels ?? []).join(", "));
  const [dueDate, setDueDate] = useState(card.due_date ?? "");
  const [checklist, setChecklist] = useState<ChecklistItem[]>(card.checklist ?? []);
  const [assigneeIds, setAssigneeIds] = useState<string[]>(card.assignee_ids ?? []);
  const [isDirty, setIsDirty] = useState(false);

  // Activity state
  const [activityEntries, setActivityEntries] = useState<ActivityEntry[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  useEffect(() => {
    if (activeTab === "activity") {
      setActivityLoading(true);
      fetchBoardActivity(username, boardId, token, { cardId: card.id, limit: 30 })
        .then(setActivityEntries)
        .catch(() => {})
        .finally(() => setActivityLoading(false));
    }
  }, [activeTab, username, boardId, token, card.id]);

  const markDirty = () => setIsDirty(true);

  const handleSave = () => {
    if (!title.trim()) return;
    const labels = labelsStr
      .split(",")
      .map((l) => l.trim())
      .filter(Boolean);
    onSave({
      ...card,
      title: title.trim(),
      details,
      priority: priority ?? null,
      labels,
      due_date: dueDate || null,
      checklist,
      assignee_ids: assigneeIds,
    });
    setIsDirty(false);
  };

  const toggleAssignee = (username: string) => {
    setAssigneeIds((prev) =>
      prev.includes(username) ? prev.filter((u) => u !== username) : [...prev, username]
    );
    markDirty();
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: "details", label: "Details" },
    { id: "checklist", label: `Checklist${checklist.length ? ` (${checklist.filter((i) => i.done).length}/${checklist.length})` : ""}` },
    { id: "comments", label: "Comments" },
    { id: "activity", label: "Activity" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/20 backdrop-blur-[2px]">
      <div
        ref={panelRef}
        className="flex h-full w-full max-w-xl flex-col border-l border-[var(--stroke)] bg-white shadow-2xl"
      >
        {/* Header */}
        <div className="flex shrink-0 items-start gap-3 border-b border-[var(--stroke)] px-6 py-4">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[var(--gray-text)]">
              {columnTitle}
            </p>
            <input
              value={title}
              onChange={(e) => { setTitle(e.target.value); markDirty(); }}
              className="mt-1 w-full border-none bg-transparent font-display text-lg font-semibold text-[var(--navy-dark)] outline-none"
              placeholder="Card title"
            />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-[var(--gray-text)] transition hover:bg-[var(--surface)] hover:text-[var(--navy-dark)]"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex shrink-0 gap-0 border-b border-[var(--stroke)] px-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`border-b-2 px-3 py-2.5 text-xs font-semibold transition ${
                activeTab === tab.id
                  ? "border-[var(--primary-blue)] text-[var(--primary-blue)]"
                  : "border-transparent text-[var(--gray-text)] hover:text-[var(--navy-dark)]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {activeTab === "details" && (
            <div className="space-y-5">
              {/* Priority */}
              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.25em] text-[var(--gray-text)]">
                  Priority
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => { setPriority(null); markDirty(); }}
                    className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold transition ${
                      !priority
                        ? "border-[var(--stroke)] bg-[var(--surface)] text-[var(--navy-dark)]"
                        : "border-[var(--stroke)] text-[var(--gray-text)]"
                    }`}
                  >
                    None
                  </button>
                  {PRIORITIES.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => { setPriority(p); markDirty(); }}
                      className="rounded-full border px-2.5 py-1 text-[10px] font-semibold transition"
                      style={
                        priority === p
                          ? { backgroundColor: PRIORITY_COLORS[p] + "22", color: PRIORITY_COLORS[p], borderColor: PRIORITY_COLORS[p] + "88" }
                          : { borderColor: PRIORITY_COLORS[p] + "44", color: PRIORITY_COLORS[p] + "99" }
                      }
                    >
                      {PRIORITY_LABELS[p]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Due date */}
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-[0.25em] text-[var(--gray-text)]">
                  Due Date
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => { setDueDate(e.target.value); markDirty(); }}
                    className="mt-1.5 block w-full rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-xs text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)]"
                  />
                </label>
              </div>

              {/* Labels */}
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-[0.25em] text-[var(--gray-text)]">
                  Labels <span className="text-[var(--gray-text)] normal-case font-normal">(comma-separated)</span>
                  <input
                    value={labelsStr}
                    onChange={(e) => { setLabelsStr(e.target.value); markDirty(); }}
                    placeholder="e.g. design, qa"
                    className="mt-1.5 block w-full rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-xs text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)]"
                  />
                </label>
              </div>

              {/* Assignees */}
              {boardMembers.length > 0 && (
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.25em] text-[var(--gray-text)]">
                    Assignees
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {boardMembers.map((member) => {
                      const isAssigned = assigneeIds.includes(member);
                      return (
                        <button
                          key={member}
                          type="button"
                          onClick={() => toggleAssignee(member)}
                          className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold transition"
                          style={
                            isAssigned
                              ? { backgroundColor: "var(--primary-blue)", color: "white", borderColor: "var(--primary-blue)" }
                              : { borderColor: "var(--stroke)", color: "var(--gray-text)" }
                          }
                        >
                          {member}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Description */}
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-[0.25em] text-[var(--gray-text)]">
                  Description
                  <textarea
                    value={details}
                    onChange={(e) => { setDetails(e.target.value); markDirty(); }}
                    rows={5}
                    placeholder="Add a description..."
                    className="mt-1.5 block w-full resize-none rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-xs leading-relaxed text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)]"
                  />
                </label>
              </div>
            </div>
          )}

          {activeTab === "checklist" && (
            <ChecklistSection
              items={checklist}
              onChange={(items) => { setChecklist(items); markDirty(); }}
            />
          )}

          {activeTab === "comments" && (
            <CommentsSection username={username} boardId={boardId} cardId={card.id} />
          )}

          {activeTab === "activity" && (
            <ActivityFeed
              entries={activityEntries}
              isLoading={activityLoading}
              emptyMessage="No activity for this card yet."
            />
          )}
        </div>

        {/* Footer: save button */}
        {(activeTab === "details" || activeTab === "checklist") && (
          <div className="shrink-0 border-t border-[var(--stroke)] px-6 py-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={!title.trim() || !isDirty}
              className="w-full rounded-full bg-[var(--secondary-purple)] px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.22em] text-white transition hover:brightness-110 disabled:opacity-40"
            >
              Save Changes
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
