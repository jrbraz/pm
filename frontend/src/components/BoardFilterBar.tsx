"use client";

import { CARD_TYPE_COLORS, CARD_TYPE_LABELS, PRIORITY_COLORS, PRIORITY_LABELS, type CardType, type Priority } from "@/lib/kanban";
import { CardTypeIcon } from "@/components/Icons";

export type DueDateFilter = "all" | "today" | "week" | "overdue";
export type CardSortMode = "manual" | "due-date";

const FILTER_CARD_TYPES: CardType[] = ["initiative", "epic", "task", "story", "change_scope"];

type BoardFilterBarProps = {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filterPriority: Priority | null;
  onFilterPriorityChange: (priority: Priority | null) => void;
  filterDueDate: DueDateFilter;
  onFilterDueDateChange: (filter: DueDateFilter) => void;
  filterCardType: CardType | null;
  onFilterCardTypeChange: (cardType: CardType | null) => void;
  filterLabel: string;
  onFilterLabelChange: (label: string) => void;
  sortMode: CardSortMode;
  onSortModeChange: (sortMode: CardSortMode) => void;
  allLabels: string[];
  hasActiveFilter: boolean;
  onClearFilters: () => void;
};

const PRIORITIES: Priority[] = ["critical", "high", "medium", "low"];

export const BoardFilterBar = ({
  searchQuery,
  onSearchChange,
  filterPriority,
  onFilterPriorityChange,
  filterDueDate,
  onFilterDueDateChange,
  filterCardType,
  onFilterCardTypeChange,
  filterLabel,
  onFilterLabelChange,
  sortMode,
  onSortModeChange,
  allLabels,
  hasActiveFilter,
  onClearFilters,
}: BoardFilterBarProps) => {
  return (
    <div className="flex flex-wrap items-start gap-3">
      {/* Search */}
      <div className="relative min-w-[180px] max-w-xs flex-1">
        <svg
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--gray-text)]"
          width="13"
          height="13"
          viewBox="0 0 16 16"
          fill="currentColor"
        >
          <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.099zm-5.44 1.156a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11z" />
        </svg>
        <input
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search cards..."
          className="w-full rounded-xl border border-[var(--stroke)] bg-white py-1.5 pl-8 pr-3 text-xs text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)]"
        />
      </div>

      {/* Divider */}
      <div className="hidden h-7 w-px bg-[var(--stroke)] sm:block" />

      {/* Priority group */}
      <div>
        <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
          Priority
        </p>
        <div className="flex items-center gap-1">
          {PRIORITIES.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onFilterPriorityChange(filterPriority === p ? null : p)}
              className="rounded-full border px-2 py-0.5 text-[10px] font-semibold transition"
              style={
                filterPriority === p
                  ? {
                      backgroundColor: PRIORITY_COLORS[p] + "22",
                      color: PRIORITY_COLORS[p],
                      borderColor: PRIORITY_COLORS[p] + "66",
                    }
                  : {
                      borderColor: PRIORITY_COLORS[p] + "33",
                      color: PRIORITY_COLORS[p] + "99",
                    }
              }
            >
              {PRIORITY_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="hidden h-7 w-px bg-[var(--stroke)] sm:block" />

      {/* Due date group */}
      <div>
        <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
          Due date
        </p>
        <div className="flex items-center gap-1">
          {[
            { value: "today", label: "Today" },
            { value: "week", label: "This week" },
            { value: "overdue", label: "Overdue" },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() =>
                onFilterDueDateChange(
                  filterDueDate === option.value ? "all" : (option.value as DueDateFilter)
                )
              }
              className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold transition ${
                filterDueDate === option.value
                  ? "border-[var(--primary-blue)] bg-[var(--primary-blue)]/10 text-[var(--primary-blue)]"
                  : "border-[var(--stroke)] text-[var(--gray-text)] hover:text-[var(--navy-dark)]"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="hidden h-7 w-px bg-[var(--stroke)] sm:block" />

      {/* Type group */}
      <div>
        <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
          Type
        </p>
        <div className="flex items-center gap-1">
          {FILTER_CARD_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onFilterCardTypeChange(filterCardType === t ? null : t)}
              className="flex items-center gap-0.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold transition"
              style={
                filterCardType === t
                  ? {
                      backgroundColor: CARD_TYPE_COLORS[t] + "20",
                      color: CARD_TYPE_COLORS[t],
                      borderColor: CARD_TYPE_COLORS[t] + "66",
                    }
                  : {
                      borderColor: CARD_TYPE_COLORS[t] + "33",
                      color: CARD_TYPE_COLORS[t] + "88",
                    }
              }
            >
              <CardTypeIcon type={t} size={9} />
              {CARD_TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="hidden h-7 w-px bg-[var(--stroke)] sm:block" />

      {/* Label + Sort group */}
      <div>
        <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
          Options
        </p>
        <div className="flex items-center gap-1.5">
          {allLabels.length > 0 && (
            <select
              value={filterLabel}
              onChange={(e) => onFilterLabelChange(e.target.value)}
              className="rounded-lg border border-[var(--stroke)] bg-white px-2 py-0.5 text-[10px] font-medium text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
            >
              <option value="">All labels</option>
              {allLabels.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          )}

          <select
            aria-label="Card sort"
            value={sortMode}
            onChange={(e) => onSortModeChange(e.target.value as CardSortMode)}
            className="rounded-lg border border-[var(--stroke)] bg-white px-2 py-0.5 text-[10px] font-medium text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
          >
            <option value="manual">Manual order</option>
            <option value="due-date">Sort by due date</option>
          </select>

          {hasActiveFilter && (
            <button
              type="button"
              onClick={onClearFilters}
              className="rounded-lg border border-[var(--stroke)] px-2 py-0.5 text-[10px] font-semibold text-[var(--gray-text)] transition hover:text-[var(--navy-dark)]"
            >
              Clear all
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
