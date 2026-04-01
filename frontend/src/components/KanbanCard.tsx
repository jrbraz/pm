import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import clsx from "clsx";
import type { Card } from "@/lib/kanban";
import { PRIORITY_COLORS, PRIORITY_LABELS } from "@/lib/kanban";

type KanbanCardProps = {
  card: Card;
  onDelete: (cardId: string) => void;
};

export const KanbanCard = ({ card, onDelete }: KanbanCardProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isOverdue =
    card.due_date &&
    new Date(card.due_date) < new Date(new Date().toISOString().split("T")[0]);

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={clsx(
        "group rounded-2xl border border-transparent bg-white px-3 py-3 shadow-[0_2px_8px_rgba(3,33,71,0.07)]",
        "transition-all duration-150",
        isDragging && "opacity-60 shadow-[0_18px_32px_rgba(3,33,71,0.16)]"
      )}
      data-testid={`card-${card.id}`}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          className="mt-0.5 shrink-0 cursor-grab touch-none text-[var(--gray-text)] opacity-0 transition group-hover:opacity-40 active:cursor-grabbing"
          aria-label="Drag card"
          {...attributes}
          {...listeners}
        >
          <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor" aria-hidden="true">
            <circle cx="2.5" cy="2" r="1.5" />
            <circle cx="7.5" cy="2" r="1.5" />
            <circle cx="2.5" cy="7" r="1.5" />
            <circle cx="7.5" cy="7" r="1.5" />
            <circle cx="2.5" cy="12" r="1.5" />
            <circle cx="7.5" cy="12" r="1.5" />
          </svg>
        </button>
        <div className="min-w-0 flex-1">
          <h4 className="font-display text-sm font-semibold leading-snug text-[var(--navy-dark)]">
            {card.title}
          </h4>
          {card.details && (
            <p className="mt-1 text-xs leading-5 text-[var(--gray-text)]">{card.details}</p>
          )}

          {/* Priority + labels + due date row */}
          <div className="mt-2 flex flex-wrap items-center gap-1">
            {card.priority && (
              <span
                className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                style={{
                  backgroundColor: PRIORITY_COLORS[card.priority] + "1a",
                  color: PRIORITY_COLORS[card.priority],
                }}
              >
                {PRIORITY_LABELS[card.priority]}
              </span>
            )}
            {card.labels?.map((label) => (
              <span
                key={label}
                className="rounded-full bg-[var(--stroke)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--gray-text)]"
              >
                {label}
              </span>
            ))}
            {card.due_date && (
              <span
                className={clsx(
                  "flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                  isOverdue
                    ? "bg-red-50 text-red-500"
                    : "bg-[var(--stroke)] text-[var(--gray-text)]"
                )}
              >
                <svg width="9" height="9" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M5 .5a.5.5 0 0 1 .5.5V2h5V1a.5.5 0 0 1 1 0v1h1a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h1V1A.5.5 0 0 1 5 .5zm-3 5v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V6H2z" />
                </svg>
                {card.due_date}
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => onDelete(card.id)}
          className="mt-0.5 shrink-0 rounded-full p-1 text-[var(--gray-text)] opacity-0 transition group-hover:opacity-100 hover:bg-red-50 hover:text-red-400"
          aria-label={`Delete ${card.title}`}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </article>
  );
};
