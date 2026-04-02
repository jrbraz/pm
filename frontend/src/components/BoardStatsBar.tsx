"use client";

import { PRIORITY_COLORS, type BoardMember } from "@/lib/kanban";

type BoardStatsBarProps = {
  total: number;
  overdue: number;
  byPriority: { critical: number; high: number; medium: number };
  ownerUsername: string;
  members: BoardMember[];
};

export const BoardStatsBar = ({
  total,
  overdue,
  byPriority,
  ownerUsername,
  members,
}: BoardStatsBarProps) => {
  if (total === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="rounded-full border border-[var(--stroke)] bg-white px-3 py-1 text-xs font-semibold text-[var(--navy-dark)]">
        {total} cards
      </span>
      {overdue > 0 && (
        <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-500">
          {overdue} overdue
        </span>
      )}
      {byPriority.critical > 0 && (
        <span
          className="rounded-full px-3 py-1 text-xs font-semibold"
          style={{ backgroundColor: PRIORITY_COLORS.critical + "1a", color: PRIORITY_COLORS.critical }}
        >
          {byPriority.critical} critical
        </span>
      )}
      {byPriority.high > 0 && (
        <span
          className="rounded-full px-3 py-1 text-xs font-semibold"
          style={{ backgroundColor: PRIORITY_COLORS.high + "1a", color: PRIORITY_COLORS.high }}
        >
          {byPriority.high} high
        </span>
      )}
      {members.length > 0 && (
        <div className="flex items-center gap-1">
          {[ownerUsername, ...members.map((m) => m.username)].slice(0, 4).map((m) => (
            <div
              key={m}
              className="flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-bold text-white"
              style={{ backgroundColor: "var(--primary-blue)" }}
              title={m}
            >
              {m.slice(0, 2).toUpperCase()}
            </div>
          ))}
          {members.length > 3 && (
            <span className="text-[10px] font-semibold text-[var(--gray-text)]">
              +{members.length - 3}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
