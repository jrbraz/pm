import type { Card } from "@/lib/kanban";
import {
  PRIORITY_COLORS,
  PRIORITY_LABELS,
  formatDueDateChip,
  isDueThisWeek,
  isDueToday,
  isOverdueDate,
} from "@/lib/kanban";

type KanbanCardPreviewProps = {
  card: Card;
};

export const KanbanCardPreview = ({ card }: KanbanCardPreviewProps) => {
  const isOverdue = isOverdueDate(card.due_date);
  const isToday = isDueToday(card.due_date);
  const isThisWeek = !isToday && isDueThisWeek(card.due_date);

  return (
    <article className="rounded-2xl border border-transparent bg-white px-3 py-3 shadow-[0_18px_32px_rgba(3,33,71,0.18)]">
      <div className="flex items-start gap-2">
        <div className="mt-0.5 shrink-0 text-[var(--gray-text)] opacity-40">
          <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor" aria-hidden="true">
            <circle cx="2.5" cy="2" r="1.5" />
            <circle cx="7.5" cy="2" r="1.5" />
            <circle cx="2.5" cy="7" r="1.5" />
            <circle cx="7.5" cy="7" r="1.5" />
            <circle cx="2.5" cy="12" r="1.5" />
            <circle cx="7.5" cy="12" r="1.5" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="font-display text-sm font-semibold leading-snug text-[var(--navy-dark)]">
            {card.title}
          </h4>
          {card.details && (
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--gray-text)]">{card.details}</p>
          )}
          <div className="mt-1.5 flex flex-wrap gap-1">
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
            {card.due_date && (
              <span
                className="rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                style={{
                  backgroundColor: isOverdue
                    ? "#fef2f2"
                    : isToday
                    ? "rgba(236,173,10,0.15)"
                    : isThisWeek
                    ? "rgba(32,157,215,0.12)"
                    : "var(--stroke)",
                  color: isOverdue
                    ? "#dc2626"
                    : isToday
                    ? "#a66f00"
                    : isThisWeek
                    ? "var(--primary-blue)"
                    : "var(--gray-text)",
                }}
              >
                {formatDueDateChip(card.due_date)}
              </span>
            )}
          </div>
        </div>
      </div>
    </article>
  );
};
