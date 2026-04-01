"use client";

import { KeyboardEvent, useState } from "react";
import { createId, type ChecklistItem } from "@/lib/kanban";

type ChecklistSectionProps = {
  items: ChecklistItem[];
  onChange: (items: ChecklistItem[]) => void;
};

export const ChecklistSection = ({ items, onChange }: ChecklistSectionProps) => {
  const [newText, setNewText] = useState("");

  const doneCount = items.filter((i) => i.done).length;
  const progress = items.length > 0 ? Math.round((doneCount / items.length) * 100) : 0;

  const handleToggle = (id: string) => {
    onChange(items.map((i) => (i.id === id ? { ...i, done: !i.done } : i)));
  };

  const handleTextChange = (id: string, text: string) => {
    onChange(items.map((i) => (i.id === id ? { ...i, text } : i)));
  };

  const handleDelete = (id: string) => {
    onChange(items.filter((i) => i.id !== id));
  };

  const handleAddItem = () => {
    const text = newText.trim();
    if (!text) return;
    onChange([...items, { id: createId("chk"), text, done: false }]);
    setNewText("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddItem();
    }
  };

  return (
    <div className="space-y-2">
      {items.length > 0 && (
        <div className="flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--surface)]">
            <div
              className="h-full rounded-full bg-[var(--primary-blue)] transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-[10px] font-semibold tabular-nums text-[var(--gray-text)]">
            {doneCount}/{items.length}
          </span>
        </div>
      )}

      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item.id} className="group flex items-start gap-2">
            <button
              type="button"
              onClick={() => handleToggle(item.id)}
              className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border border-[var(--stroke)] bg-white transition hover:border-[var(--primary-blue)]"
              style={item.done ? { backgroundColor: "var(--primary-blue)", borderColor: "var(--primary-blue)" } : {}}
              aria-label={item.done ? "Mark incomplete" : "Mark complete"}
            >
              {item.done && (
                <svg width="9" height="9" viewBox="0 0 10 10" fill="white">
                  <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                </svg>
              )}
            </button>
            <input
              value={item.text}
              onChange={(e) => handleTextChange(item.id, e.target.value)}
              className={`flex-1 border-none bg-transparent text-xs outline-none ${item.done ? "text-[var(--gray-text)] line-through" : "text-[var(--navy-dark)]"}`}
            />
            <button
              type="button"
              onClick={() => handleDelete(item.id)}
              className="mt-0.5 hidden text-[var(--gray-text)] transition hover:text-red-500 group-hover:block"
              aria-label="Remove item"
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z" />
              </svg>
            </button>
          </li>
        ))}
      </ul>

      <div className="flex gap-2">
        <input
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add an item..."
          className="flex-1 rounded-lg border border-[var(--stroke)] bg-white px-2 py-1.5 text-xs text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)]"
        />
        <button
          type="button"
          onClick={handleAddItem}
          disabled={!newText.trim()}
          className="rounded-lg border border-[var(--stroke)] px-2.5 py-1.5 text-xs font-semibold text-[var(--gray-text)] transition hover:border-[var(--primary-blue)] hover:text-[var(--primary-blue)] disabled:opacity-40"
        >
          Add
        </button>
      </div>
    </div>
  );
};
