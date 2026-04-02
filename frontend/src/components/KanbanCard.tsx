import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import clsx from "clsx";
import type { Card } from "@/lib/kanban";
import { PRIORITY_COLORS, PRIORITY_LABELS, getInitials } from "@/lib/kanban";

type KanbanCardProps = {
  card: Card;
  onDelete: (cardId: string) => void;
  onEdit: (card: Card) => void;
};

export const KanbanCard = ({ card, onDelete, onEdit }: KanbanCardProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isOverdue =
    card.due_date &&
    new Date(card.due_date) < new Date(new Date().toISOString().split("T")[0]);

  const checklist = card.checklist ?? [];
  const checklistTotal = checklist.length;
  const checklistDone = checklist.filter((i) => i.done).length;
  const hasChecklist = checklistTotal > 0;

  const assignees = card.assignee_ids ?? [];

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={clsx(
        "group rounded-2xl border border-transparent bg-white px-3 py-3 shadow-[0_2px_8px_rgba(3,33,71,0.07)]",
        "cursor-pointer transition-all duration-150 hover:border-[var(--stroke)] hover:shadow-[0_4px_12px_rgba(3,33,71,0.1)]",
        isDragging && "opacity-60 shadow-[0_18px_32px_rgba(3,33,71,0.16)]"
      )}
      data-testid={`card-${card.id}`}
      onClick={() => onEdit(card)}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          className="mt-0.5 shrink-0 cursor-grab touch-none text-[var(--gray-text)] opacity-0 transition group-hover:opacity-40 active:cursor-grabbing"
          aria-label="Drag card"
          onClick={(e) => e.stopPropagation()}
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
          <div className="flex items-center gap-1.5">
            <p className="text-[10px] font-medium text-[var(--gray-text)] opacity-60">{card.id}</p>
            {card.created_by && (
              <span className="flex items-center gap-0.5 text-[10px] text-[var(--gray-text)] opacity-60">
                <svg width="8" height="8" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4zm-1-.004c-.001-.246-.154-.986-.832-1.664C11.516 10.68 10.289 10 8 10c-2.29 0-3.516.68-4.168 1.332-.678.678-.83 1.418-.832 1.664h10z" />
                </svg>
                {card.created_by}
              </span>
            )}
          </div>
          <h4 className="font-display text-sm font-semibold leading-snug text-[var(--navy-dark)]">
            {card.title}
          </h4>
          {card.details && (
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--gray-text)]">{card.details}</p>
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
            {hasChecklist && (
              <span className="flex items-center gap-0.5 rounded-full bg-[var(--surface)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--gray-text)]">
                <svg width="9" height="9" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M14.5 3a.5.5 0 0 1 0 1H11V5h1.5a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5v-6a.5.5 0 0 1 .5-.5H5V4H1.5a.5.5 0 0 1 0-1H5v-.5A1.5 1.5 0 0 1 6.5 1h3A1.5 1.5 0 0 1 11 2.5V3h3.5zM6 2.5v.5h4v-.5a.5.5 0 0 0-.5-.5h-3a.5.5 0 0 0-.5.5z" />
                </svg>
                {checklistDone}/{checklistTotal}
              </span>
            )}
          </div>

          {/* Assignee avatars */}
          {assignees.length > 0 && (
            <div className="mt-2 flex items-center gap-1">
              {assignees.slice(0, 3).map((userId) => (
                <div
                  key={userId}
                  className="flex h-5 w-5 items-center justify-center rounded-full text-[8px] font-bold text-white"
                  style={{ backgroundColor: "var(--primary-blue)" }}
                  title={userId}
                >
                  {getInitials(userId)}
                </div>
              ))}
              {assignees.length > 3 && (
                <span className="text-[10px] font-semibold text-[var(--gray-text)]">
                  +{assignees.length - 3}
                </span>
              )}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(card.id);
          }}
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
