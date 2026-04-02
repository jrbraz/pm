import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import clsx from "clsx";
import type { Card, CardType } from "@/lib/kanban";
import {
  ALLOWED_CHILD_TYPES,
  CARD_TYPE_LABELS,
  CARD_TYPE_COLORS,
  PRIORITY_COLORS,
  PRIORITY_LABELS,
  formatDueDateChip,
  getInitials,
  isDueThisWeek,
  isDueToday,
  isOverdueDate,
} from "@/lib/kanban";
import { CardTypeIcon } from "@/components/Icons";

type KanbanCardProps = {
  card: Card;
  parentCard?: Card | null;
  onDelete: (cardId: string) => void;
  onEdit: (card: Card) => void;
  onDuplicate: (card: Card) => void;
  onAddChild?: (card: Card, childType: CardType) => void;
  onOpenParent?: (parentCard: Card) => void;
  dragDisabled?: boolean;
};

export const KanbanCard = ({
  card,
  parentCard,
  onDelete,
  onEdit,
  onDuplicate,
  onAddChild,
  onOpenParent,
  dragDisabled = false,
}: KanbanCardProps) => {
  const childTypes = ALLOWED_CHILD_TYPES[card.card_type ?? "initiative"];
  const canHaveChildren = childTypes.length > 0;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id, disabled: dragDisabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isOverdue = isOverdueDate(card.due_date);
  const isToday = isDueToday(card.due_date);
  const isThisWeek = !isToday && isDueThisWeek(card.due_date);
  const dueDateChip = formatDueDateChip(card.due_date);

  const checklist = card.checklist ?? [];
  const checklistTotal = checklist.length;
  const checklistDone = checklist.filter((i) => i.done).length;
  const hasChecklist = checklistTotal > 0;

  const assignees = card.assignee_ids ?? [];
  const typeColor = card.card_type ? CARD_TYPE_COLORS[card.card_type] : "#888";

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={clsx(
        "group rounded-2xl border bg-white shadow-[0_2px_8px_rgba(3,33,71,0.07)]",
        "cursor-pointer transition-all duration-150 hover:border-[#b0b8c4] hover:shadow-[0_4px_12px_rgba(3,33,71,0.1)]",
        isOverdue
          ? "border-red-200 bg-red-50/40 shadow-[0_4px_14px_rgba(229,62,62,0.08)]"
          : "border-[#d0d5dd]",
        isDragging && "opacity-60 shadow-[0_18px_32px_rgba(3,33,71,0.16)]"
      )}
      data-testid={`card-${card.id}`}
      onClick={() => onEdit(card)}
    >
      {/* Top color bar based on type */}
      <div
        className="h-1 rounded-t-2xl"
        style={{ backgroundColor: typeColor }}
      />

      <div className="px-3 pb-3 pt-2">
        {/* Header: drag handle + actions */}
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1 space-y-1">
            {/* Row 1: Card type */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                className={clsx(
                  "shrink-0 touch-none text-[var(--gray-text)] transition",
                  dragDisabled
                    ? "cursor-not-allowed opacity-20"
                    : "cursor-grab opacity-0 group-hover:opacity-40 active:cursor-grabbing"
                )}
                aria-label="Drag card"
                onClick={(e) => e.stopPropagation()}
                disabled={dragDisabled}
                {...attributes}
                {...listeners}
              >
                <svg width="8" height="12" viewBox="0 0 10 14" fill="currentColor" aria-hidden="true">
                  <circle cx="2.5" cy="2" r="1.5" />
                  <circle cx="7.5" cy="2" r="1.5" />
                  <circle cx="2.5" cy="7" r="1.5" />
                  <circle cx="7.5" cy="7" r="1.5" />
                  <circle cx="2.5" cy="12" r="1.5" />
                  <circle cx="7.5" cy="12" r="1.5" />
                </svg>
              </button>
              {card.card_type && (
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider"
                  style={{
                    backgroundColor: typeColor + "15",
                    color: typeColor,
                  }}
                >
                  <CardTypeIcon type={card.card_type} size={10} />
                  {CARD_TYPE_LABELS[card.card_type]}
                </span>
              )}
            </div>

            {/* Row 2: Card ID */}
            <p className="font-mono text-[10px] font-medium text-[var(--gray-text)]">{card.id}</p>
          </div>

          {/* Action buttons */}
          <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDuplicate(card); }}
              className="rounded-full p-1 text-[var(--gray-text)] hover:bg-blue-50 hover:text-[var(--primary-blue)]"
              aria-label={`Duplicate ${card.title}`}
              title="Duplicate"
            >
              <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
                <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z" />
                <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z" />
              </svg>
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDelete(card.id); }}
              className="rounded-full p-1 text-[var(--gray-text)] hover:bg-red-50 hover:text-red-400"
              aria-label={`Delete ${card.title}`}
              title="Delete"
            >
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        {/* Meta: created by + parent (each on its own line, separated) */}
        {(card.created_by || parentCard) && (
          <div className="mt-1.5 space-y-1 border-b border-dashed border-[var(--stroke)] pb-2">
            {card.created_by && (
              <p className="flex items-center gap-1 text-[10px] text-[var(--gray-text)]">
                <svg width="9" height="9" viewBox="0 0 16 16" fill="currentColor" className="opacity-50">
                  <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4zm-1-.004c-.001-.246-.154-.986-.832-1.664C11.516 10.68 10.289 10 8 10c-2.29 0-3.516.68-4.168 1.332-.678.678-.83 1.418-.832 1.664h10z" />
                </svg>
                {card.created_by}
              </p>
            )}
            {parentCard && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onOpenParent?.(parentCard); }}
                className="flex items-center gap-1 text-[10px] text-[var(--primary-blue)] hover:underline"
                title={`Open parent: ${parentCard.title}`}
              >
                <CardTypeIcon type={parentCard.card_type ?? "initiative"} size={9} />
                <span className="max-w-[140px] truncate">{parentCard.id}: {parentCard.title}</span>
              </button>
            )}
          </div>
        )}

        {/* Title */}
        <h4 className="mt-2 font-display text-[13px] font-semibold leading-snug text-[var(--navy-dark)]">
          {card.title || <span className="italic text-[var(--gray-text)]">Untitled</span>}
        </h4>

        {/* Description */}
        {card.details && (
          <p className="mt-1 line-clamp-2 text-[11px] leading-[1.6] text-[var(--gray-text)]">{card.details}</p>
        )}

        {/* Tags: priority + labels + due date + checklist */}
        {(card.priority || (card.labels && card.labels.length > 0) || card.due_date || hasChecklist) && (
          <div className="mt-2 flex flex-wrap items-center gap-1 border-t border-dashed border-[var(--stroke)] pt-2">
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
                    ? "bg-red-100 text-red-600"
                    : isToday
                    ? "bg-[var(--accent-yellow)]/15 text-[#a66f00]"
                    : isThisWeek
                    ? "bg-[var(--primary-blue)]/12 text-[var(--primary-blue)]"
                    : "bg-[var(--stroke)] text-[var(--gray-text)]"
                )}
                title={card.due_date}
              >
                <svg width="9" height="9" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M5 .5a.5.5 0 0 1 .5.5V2h5V1a.5.5 0 0 1 1 0v1h1a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h1V1A.5.5 0 0 1 5 .5zm-3 5v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V6H2z" />
                </svg>
                {dueDateChip}
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
        )}

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

      {/* Add child -- single button for 1 child type, chooser for multiple */}
      {canHaveChildren && onAddChild && (
        <div className="border-t border-dashed border-[var(--stroke)]">
          {childTypes.length === 1 ? (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onAddChild(card, childTypes[0]); }}
              className="flex w-full items-center justify-center gap-1 rounded-b-2xl py-1.5 text-[10px] font-semibold text-[var(--gray-text)] transition hover:bg-[var(--surface)] hover:text-[var(--primary-blue)]"
            >
              <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z" />
              </svg>
              Add {CARD_TYPE_LABELS[childTypes[0]].toLowerCase()}
            </button>
          ) : (
            <div className="flex items-center rounded-b-2xl">
              {childTypes.map((ct, i) => (
                <button
                  key={ct}
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onAddChild(card, ct); }}
                  className={clsx(
                    "flex flex-1 items-center justify-center gap-0.5 py-1.5 text-[9px] font-semibold transition hover:bg-[var(--surface)]",
                    i > 0 && "border-l border-dashed border-[var(--stroke)]",
                    i === 0 && "rounded-bl-2xl",
                    i === childTypes.length - 1 && "rounded-br-2xl"
                  )}
                  style={{ color: CARD_TYPE_COLORS[ct] }}
                  title={`Add ${CARD_TYPE_LABELS[ct]}`}
                >
                  <CardTypeIcon type={ct} size={9} />
                  {CARD_TYPE_LABELS[ct]}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </article>
  );
};
