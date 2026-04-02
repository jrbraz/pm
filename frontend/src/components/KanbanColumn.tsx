import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { Card, Column, Priority } from "@/lib/kanban";
import { KanbanCard } from "@/components/KanbanCard";
import { NewCardForm } from "@/components/NewCardForm";

type KanbanColumnProps = {
  column: Column;
  cards: Card[];
  onRename: (columnId: string, title: string) => void;
  onAddCard: (columnId: string, title: string, details: string, priority?: Priority | null, labels?: string[], dueDate?: string | null) => void;
  onDeleteCard: (columnId: string, cardId: string) => void;
  onEditCard: (card: Card) => void;
  onDuplicateCard: (columnId: string, card: Card) => void;
  onDeleteColumn: (columnId: string) => void;
};

export const KanbanColumn = ({
  column,
  cards,
  onRename,
  onAddCard,
  onDeleteCard,
  onEditCard,
  onDuplicateCard,
  onDeleteColumn,
}: KanbanColumnProps) => {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const [localTitle, setLocalTitle] = useState(column.title);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync title from parent (e.g. AI board updates) — intentional pattern
  useEffect(() => {
    setLocalTitle(column.title); // eslint-disable-line react-hooks/set-state-in-effect
  }, [column.title]);

  const handleTitleChange = useCallback(
    (value: string) => {
      setLocalTitle(value);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        onRename(column.id, value);
      }, 400);
    },
    [column.id, onRename]
  );

  const handleTitleBlur = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    onRename(column.id, localTitle);
  }, [column.id, localTitle, onRename]);

  const handleDeleteColumn = () => {
    if (cards.length > 0) {
      if (!window.confirm(`Delete "${column.title}"? The ${cards.length} card(s) will also be removed.`)) {
        return;
      }
    }
    onDeleteColumn(column.id);
  };

  return (
    <section
      ref={setNodeRef}
      className={clsx(
        "flex min-h-[520px] flex-col rounded-3xl border border-[var(--stroke)] bg-[var(--surface-strong)] p-4 shadow-[var(--shadow)] transition",
        isOver && "ring-2 ring-[var(--accent-yellow)]"
      )}
      data-testid={`column-${column.id}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <div className="h-2 w-10 rounded-full bg-[var(--accent-yellow)]" />
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
              {cards.length} cards
            </span>
          </div>
          <input
            value={localTitle}
            onChange={(event) => handleTitleChange(event.target.value)}
            onBlur={handleTitleBlur}
            className="mt-3 w-full bg-transparent font-display text-lg font-semibold text-[var(--navy-dark)] outline-none"
            aria-label="Column title"
          />
        </div>
        <button
          type="button"
          title="Delete column"
          onClick={handleDeleteColumn}
          className="mt-1 shrink-0 rounded-full p-1.5 text-[var(--gray-text)] opacity-0 transition hover:bg-red-50 hover:text-red-400 group-hover:opacity-100 focus:opacity-100"
          aria-label={`Delete column ${column.title}`}
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
            <path d="M11 1.75V3h2.25a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1 0-1.5H5V1.75C5 .784 5.784 0 6.75 0h2.5C10.216 0 11 .784 11 1.75ZM4.496 6.675l.66 6.6a.25.25 0 0 0 .249.225h5.19a.25.25 0 0 0 .249-.225l.66-6.6a.75.75 0 0 1 1.492.149l-.66 6.6A1.748 1.748 0 0 1 10.595 15h-5.19a1.75 1.75 0 0 1-1.741-1.575l-.66-6.6a.75.75 0 1 1 1.492-.15ZM6.5 1.75V3h3V1.75a.25.25 0 0 0-.25-.25h-2.5a.25.25 0 0 0-.25.25Z" />
          </svg>
        </button>
      </div>
      <div className="mt-4 flex flex-1 flex-col gap-3">
        <SortableContext items={column.cardIds} strategy={verticalListSortingStrategy}>
          {cards.map((card) => (
            <KanbanCard
              key={card.id}
              card={card}
              onDelete={(cardId) => onDeleteCard(column.id, cardId)}
              onEdit={onEditCard}
              onDuplicate={(c) => onDuplicateCard(column.id, c)}
            />
          ))}
        </SortableContext>
        {cards.length === 0 && (
          <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-[var(--stroke)] px-3 py-6 text-center text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
            Drop a card here
          </div>
        )}
      </div>
      <NewCardForm
        onAdd={(title, details, priority, labels, dueDate) =>
          onAddCard(column.id, title, details, priority, labels, dueDate)
        }
      />
    </section>
  );
};
