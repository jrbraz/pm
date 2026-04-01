import type { Card } from "@/lib/kanban";

type KanbanCardPreviewProps = {
  card: Card;
};

export const KanbanCardPreview = ({ card }: KanbanCardPreviewProps) => (
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
        <p className="mt-1 text-xs leading-5 text-[var(--gray-text)]">{card.details}</p>
      </div>
    </div>
  </article>
);
