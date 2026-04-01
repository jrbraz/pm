"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import type { Card, Priority } from "@/lib/kanban";
import { PRIORITY_COLORS } from "@/lib/kanban";

const PRIORITIES: { value: Priority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

type CardEditModalProps = {
  card: Card;
  columnTitle: string;
  onSave: (updated: Card) => void;
  onClose: () => void;
};

export const CardEditModal = ({ card, columnTitle, onSave, onClose }: CardEditModalProps) => {
  const [title, setTitle] = useState(card.title);
  const [details, setDetails] = useState(card.details);
  const [priority, setPriority] = useState<Priority | null>(card.priority ?? null);
  const [labels, setLabels] = useState((card.labels ?? []).join(", "));
  const [dueDate, setDueDate] = useState(card.due_date ?? "");
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const parsedLabels = labels
      .split(",")
      .map((l) => l.trim())
      .filter(Boolean);
    onSave({
      ...card,
      title: title.trim(),
      details: details.trim(),
      priority,
      labels: parsedLabels,
      due_date: dueDate || null,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(3,33,71,0.35)] p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-[28px] border border-[var(--stroke)] bg-white shadow-[0_24px_64px_rgba(3,33,71,0.2)]">
        <div className="flex items-center justify-between border-b border-[var(--stroke)] px-6 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[var(--gray-text)]">
              {columnTitle}
            </p>
            <p className="mt-0.5 text-sm font-semibold text-[var(--navy-dark)]">Edit card</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-[var(--gray-text)] transition hover:bg-[var(--stroke)] hover:text-[var(--navy-dark)]"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          {/* Title */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-[0.25em] text-[var(--gray-text)]">
              Title
            </label>
            <input
              ref={titleRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="mt-1.5 w-full rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-sm font-medium text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)]"
            />
          </div>

          {/* Details */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-[0.25em] text-[var(--gray-text)]">
              Details
            </label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={3}
              className="mt-1.5 w-full resize-none rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-sm text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)]"
            />
          </div>

          {/* Priority */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-[0.25em] text-[var(--gray-text)]">
              Priority
            </label>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setPriority(null)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                  priority === null
                    ? "border-[var(--navy-dark)] bg-[var(--navy-dark)] text-white"
                    : "border-[var(--stroke)] text-[var(--gray-text)] hover:border-[var(--navy-dark)]"
                }`}
              >
                None
              </button>
              {PRIORITIES.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPriority(p.value)}
                  className="rounded-full border px-3 py-1 text-xs font-medium transition"
                  style={
                    priority === p.value
                      ? {
                          backgroundColor: PRIORITY_COLORS[p.value] + "22",
                          color: PRIORITY_COLORS[p.value],
                          borderColor: PRIORITY_COLORS[p.value] + "66",
                        }
                      : {
                          borderColor: PRIORITY_COLORS[p.value] + "44",
                          color: PRIORITY_COLORS[p.value] + "aa",
                        }
                  }
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Labels */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-[0.25em] text-[var(--gray-text)]">
              Labels
              <span className="ml-1 font-normal normal-case tracking-normal">(comma separated)</span>
            </label>
            <input
              value={labels}
              onChange={(e) => setLabels(e.target.value)}
              placeholder="e.g. backend, urgent, v2"
              className="mt-1.5 w-full rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-sm text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)]"
            />
          </div>

          {/* Due date */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-[0.25em] text-[var(--gray-text)]">
              Due date
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-sm text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)]"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-[var(--stroke)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)] transition hover:text-[var(--navy-dark)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-full bg-[var(--secondary-purple)] px-5 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:brightness-110"
            >
              Save changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
