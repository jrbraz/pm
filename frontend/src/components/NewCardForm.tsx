import { useState, type FormEvent } from "react";
import type { Priority } from "@/lib/kanban";

const PRIORITIES: { value: Priority; label: string; color: string }[] = [
  { value: "low", label: "Low", color: "#888888" },
  { value: "medium", label: "Medium", color: "#209dd7" },
  { value: "high", label: "High", color: "#ecad0a" },
  { value: "critical", label: "Critical", color: "#e53e3e" },
];

const initialFormState = {
  title: "",
  details: "",
  priority: null as Priority | null,
  labels: "",
  due_date: "",
};

type NewCardFormProps = {
  onAdd: (
    title: string,
    details: string,
    priority?: Priority | null,
    labels?: string[],
    dueDate?: string | null
  ) => void;
};

export const NewCardForm = ({ onAdd }: NewCardFormProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [formState, setFormState] = useState(initialFormState);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!formState.title.trim()) return;
    const labels = formState.labels
      .split(",")
      .map((l) => l.trim())
      .filter(Boolean);
    onAdd(
      formState.title.trim(),
      formState.details.trim(),
      formState.priority,
      labels,
      formState.due_date || null
    );
    setFormState(initialFormState);
    setIsOpen(false);
  };

  return (
    <div className="mt-4">
      {isOpen ? (
        <form onSubmit={handleSubmit} className="space-y-2">
          <input
            value={formState.title}
            onChange={(event) =>
              setFormState((prev) => ({ ...prev, title: event.target.value }))
            }
            placeholder="Card title"
            className="w-full rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-sm font-medium text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)]"
            required
            autoFocus
          />
          <textarea
            value={formState.details}
            onChange={(event) =>
              setFormState((prev) => ({ ...prev, details: event.target.value }))
            }
            placeholder="Details (optional)"
            rows={2}
            className="w-full resize-none rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-sm text-[var(--gray-text)] outline-none transition focus:border-[var(--primary-blue)]"
          />

          {/* Priority selector */}
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => setFormState((prev) => ({ ...prev, priority: null }))}
              className={`rounded-full px-2 py-0.5 text-xs font-medium transition ${
                formState.priority === null
                  ? "bg-[var(--stroke)] text-[var(--navy-dark)]"
                  : "text-[var(--gray-text)] hover:bg-[var(--stroke)]"
              }`}
            >
              None
            </button>
            {PRIORITIES.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setFormState((prev) => ({ ...prev, priority: p.value }))}
                className={`rounded-full px-2 py-0.5 text-xs font-medium transition ${
                  formState.priority === p.value ? "opacity-100" : "opacity-50 hover:opacity-75"
                }`}
                style={{
                  backgroundColor: formState.priority === p.value ? p.color + "22" : undefined,
                  color: p.color,
                  border: `1px solid ${p.color}44`,
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Labels */}
          <input
            value={formState.labels}
            onChange={(e) => setFormState((prev) => ({ ...prev, labels: e.target.value }))}
            placeholder="Labels (comma separated)"
            className="w-full rounded-xl border border-[var(--stroke)] bg-white px-3 py-1.5 text-xs text-[var(--gray-text)] outline-none transition focus:border-[var(--primary-blue)]"
          />

          {/* Due date */}
          <input
            type="date"
            value={formState.due_date}
            onChange={(e) => setFormState((prev) => ({ ...prev, due_date: e.target.value }))}
            className="w-full rounded-xl border border-[var(--stroke)] bg-white px-3 py-1.5 text-xs text-[var(--gray-text)] outline-none transition focus:border-[var(--primary-blue)]"
          />

          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="rounded-full bg-[var(--secondary-purple)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:brightness-110"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setFormState(initialFormState);
              }}
              className="rounded-full border border-[var(--stroke)] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--gray-text)] transition hover:text-[var(--navy-dark)]"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="flex w-full items-center justify-center gap-1.5 rounded-full border border-dashed border-[var(--stroke)] px-3 py-2 text-xs font-semibold text-[var(--primary-blue)] transition hover:border-[var(--primary-blue)] hover:bg-white"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          Add card
        </button>
      )}
    </div>
  );
};
